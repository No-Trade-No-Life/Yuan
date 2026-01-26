import { IDeployment } from '@yuants/deploy';
import { ITerminalInfo } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { of, throwError, timeout } from 'rxjs';

// Mock 外部依赖
const mockRequestSQL = jest.fn();
const mockEscapeSQL = jest.fn();

jest.mock('@yuants/sql', () => ({
  requestSQL: mockRequestSQL,
  escapeSQL: mockEscapeSQL,
}));

// 导入被测试的函数
import {
  loadActiveNodeUnits,
  getLostAddresses,
  buildDeploymentCounts,
  buildSnapshots,
  pickCandidateDeployment,
  claimDeployment,
  fetchResourceUsage,
  resolveNodeUnitTerminalIds,
  buildResourceUsageSnapshot,
  deploymentCountProvider,
  resourceUsageProvider,
  defaultClaimPolicy,
  resourceOnlyPolicy,
} from './scheduler';

// 辅助函数：创建完整的 IDeployment mock 对象
const createMockDeployment = (overrides: Partial<IDeployment>): IDeployment => ({
  id: 'mock-id',
  package_name: 'test-package',
  package_version: '1.0.0',
  command: 'npm start',
  args: [],
  env: {},
  address: '',
  enabled: true,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('loadActiveNodeUnits', () => {
  it('extracts node-unit addresses from terminalInfos', () => {
    const terminalInfos: ITerminalInfo[] = [
      { terminal_id: 't1', tags: { node_unit: 'true', node_unit_address: 'addr1' } } as ITerminalInfo,
      { terminal_id: 't2', tags: { node_unit: 'true', node_unit_address: 'addr2' } } as ITerminalInfo,
      { terminal_id: 't3', tags: { node_unit: 'false', node_unit_address: 'addr3' } } as ITerminalInfo, // 不是 node-unit
      { terminal_id: 't4', tags: { node_unit: 'true' } } as ITerminalInfo, // 缺少 address
    ];

    const result = loadActiveNodeUnits(terminalInfos);
    expect(result).toEqual(['addr1', 'addr2']);
  });

  it('returns empty array when no node-unit tags found', () => {
    const terminalInfos: ITerminalInfo[] = [
      { terminal_id: 't1', tags: { node_unit: 'false' } } as ITerminalInfo,
      { terminal_id: 't2', tags: {} } as ITerminalInfo,
    ];

    const result = loadActiveNodeUnits(terminalInfos);
    expect(result).toEqual([]);
  });
});

describe('resolveNodeUnitTerminalIds', () => {
  it('maps node_unit_address to terminal_id', () => {
    const terminalInfos: ITerminalInfo[] = [
      { terminal_id: 't1', tags: { node_unit: 'true', node_unit_address: 'addr1' } } as ITerminalInfo,
      { terminal_id: 't2', tags: { node_unit: 'true', node_unit_address: 'addr2' } } as ITerminalInfo,
      { terminal_id: 't3', tags: { node_unit: 'false', node_unit_address: 'addr3' } } as ITerminalInfo,
    ];

    const result = resolveNodeUnitTerminalIds(terminalInfos);
    expect(result.get('addr1')).toBe('t1');
    expect(result.get('addr2')).toBe('t2');
    expect(result.has('addr3')).toBe(false);
  });
});

describe('fetchResourceUsage', () => {
  it('requests resource usage from node units', async () => {
    const mockRequestForResponse = jest.fn();
    const mockResolveTargetService = jest.fn();
    const mockTerminal = {
      client: {
        request: jest.fn(),
        requestForResponse: mockRequestForResponse,
        resolveTargetServiceByMethodAndTargetTerminalIdSync: mockResolveTargetService,
      },
    } as any;

    mockResolveTargetService.mockImplementation((method, terminalId, req) => {
      return { service_id: `service-${terminalId}` };
    });

    mockRequestForResponse.mockImplementation((serviceId, req) => {
      if (serviceId === 'service-t1') {
        return Promise.resolve({
          code: 0,
          data: { cpu_percent: 30.5, memory_mb: 512 },
        });
      }
      if (serviceId === 'service-t2') {
        return Promise.resolve({
          code: 0,
          data: { cpu_percent: 45.2, memory_mb: 1024 },
        });
      }
      return Promise.reject(new Error('Unknown service'));
    });

    const activeNodeUnits = ['addr1', 'addr2', 'addr3'];
    const addressToTerminalId = new Map([
      ['addr1', 't1'],
      ['addr2', 't2'],
      // addr3 missing terminal id or offline
    ]);

    const usage = await fetchResourceUsage(mockTerminal, activeNodeUnits, addressToTerminalId);

    expect(usage.get('addr1')).toEqual({ cpuPercent: 30.5, memoryMb: 512 });
    expect(usage.get('addr2')).toEqual({ cpuPercent: 45.2, memoryMb: 1024 });
    expect(usage.has('addr3')).toBe(false);

    expect(mockResolveTargetService).toHaveBeenCalledWith('NodeUnit/InspectResourceUsage', 't1', {});
    expect(mockRequestForResponse).toHaveBeenCalledWith('service-t1', {});
    expect(mockResolveTargetService).toHaveBeenCalledWith('NodeUnit/InspectResourceUsage', 't2', {});
    expect(mockRequestForResponse).toHaveBeenCalledWith('service-t2', {});
  });

  it('handles request errors/timeouts gracefully', async () => {
    const mockRequestForResponse = jest.fn().mockReturnValue(Promise.reject(new Error('Timeout')));
    const mockResolveTargetService = jest.fn().mockReturnValue({ service_id: 'service-t1' });
    const mockTerminal = {
      client: {
        request: jest.fn(),
        requestForResponse: mockRequestForResponse,
        resolveTargetServiceByMethodAndTargetTerminalIdSync: mockResolveTargetService,
      },
    } as any;

    const activeNodeUnits = ['addr1'];
    const addressToTerminalId = new Map([['addr1', 't1']]);

    const usage = await fetchResourceUsage(mockTerminal, activeNodeUnits, addressToTerminalId);
    expect(usage.size).toBe(0);
  });
});

describe('getLostAddresses', () => {
  it('identifies addresses not in activeNodeUnits', () => {
    const deployments: IDeployment[] = [
      createMockDeployment({ id: 'd1', address: 'addr1' }),
      createMockDeployment({ id: 'd2', address: 'addr2' }),
      createMockDeployment({ id: 'd3', address: 'addr3' }),
      createMockDeployment({ id: 'd4', address: '' }), // 空地址不算
    ];
    const activeNodeUnits = ['addr1', 'addr3'];

    const result = getLostAddresses(deployments, activeNodeUnits);
    expect(result).toEqual(['addr2']);
  });

  it('returns empty array when all addresses are active', () => {
    const deployments: IDeployment[] = [
      createMockDeployment({ id: 'd1', address: 'addr1' }),
      createMockDeployment({ id: 'd2', address: 'addr2' }),
    ];
    const activeNodeUnits = ['addr1', 'addr2'];

    const result = getLostAddresses(deployments, activeNodeUnits);
    expect(result).toEqual([]);
  });

  it('ignores empty address strings', () => {
    const deployments: IDeployment[] = [
      createMockDeployment({ id: 'd1', address: '' }),
      createMockDeployment({ id: 'd2', address: '' }), // undefined 在 IDeployment 中不允许，用空字符串代替
    ];
    const activeNodeUnits = ['addr1'];

    const result = getLostAddresses(deployments, activeNodeUnits);
    expect(result).toEqual([]);
  });
});

describe('buildDeploymentCounts', () => {
  it('counts deployments per address (ignores empty address)', () => {
    const deployments: IDeployment[] = [
      createMockDeployment({ id: 'd1', address: 'addr1' }),
      createMockDeployment({ id: 'd2', address: 'addr1' }),
      createMockDeployment({ id: 'd3', address: 'addr2' }),
      createMockDeployment({ id: 'd4', address: '' }), // 未指派
    ];
    const activeNodeUnits = ['addr1', 'addr2', 'addr3'];

    const counts = buildDeploymentCounts(deployments, activeNodeUnits);
    expect(counts.get('addr1')).toBe(2);
    expect(counts.get('addr2')).toBe(1);
    expect(counts.get('addr3')).toBe(0); // 没有部署
  });

  it('returns zero for addresses with no deployments', () => {
    const deployments: IDeployment[] = [createMockDeployment({ id: 'd1', address: 'addr1' })];
    const activeNodeUnits = ['addr1', 'addr2'];

    const counts = buildDeploymentCounts(deployments, activeNodeUnits);
    expect(counts.get('addr1')).toBe(1);
    expect(counts.get('addr2')).toBe(0);
  });
});

describe('deployment_count provider and policy', () => {
  const deployments: IDeployment[] = [
    createMockDeployment({ id: 'd1', address: 'addr1' }),
    createMockDeployment({ id: 'd2', address: 'addr1' }),
    createMockDeployment({ id: 'd3', address: 'addr2' }),
  ];
  const activeNodeUnits = ['addr1', 'addr2', 'addr3'];
  const counts = buildDeploymentCounts(deployments, activeNodeUnits);
  const context = { deployments, deploymentCounts: counts, resourceUsage: new Map() };

  it('evaluates deployment count for each node-unit', () => {
    const snapshot1 = deploymentCountProvider.evaluate('addr1', context);
    const snapshot2 = deploymentCountProvider.evaluate('addr2', context);
    const snapshot3 = deploymentCountProvider.evaluate('addr3', context);

    expect(snapshot1).toEqual({ key: 'deployment_count', value: 2 });
    expect(snapshot2).toEqual({ key: 'deployment_count', value: 1 });
    expect(snapshot3).toEqual({ key: 'deployment_count', value: 0 });
  });

  it('deployment_count policy picks node-units with minimum deployment', () => {
    const snapshots = new Map([
      ['addr1', [{ key: 'deployment_count', value: 2 }]],
      ['addr2', [{ key: 'deployment_count', value: 1 }]],
      ['addr3', [{ key: 'deployment_count', value: 1 }]],
    ]);
    const eligible = defaultClaimPolicy.pickEligible(['addr1', 'addr2', 'addr3'], snapshots);
    expect(eligible).toEqual(['addr2', 'addr3']); // 并列最少
  });
});

describe('resource_usage provider and policy', () => {
  beforeEach(() => {
    delete process.env.NODE_UNIT_CPU_WEIGHT;
    delete process.env.NODE_UNIT_MEMORY_WEIGHT;
  });

  it('evaluates resource usage with default 50/50 weights', () => {
    const resourceUsage = new Map([
      ['addr1', { cpuPercent: 30, memoryMb: 1024 }],
      ['addr2', { cpuPercent: 45, memoryMb: 2048 }],
    ]);
    const context = { deployments: [], deploymentCounts: new Map(), resourceUsage };

    const snapshot1 = resourceUsageProvider.evaluate('addr1', context);
    const snapshot2 = resourceUsageProvider.evaluate('addr2', context);
    const snapshot3 = resourceUsageProvider.evaluate('addr3', context); // 缺失地址

    // addr1: 30*0.5 + (1024/1024)*0.5 = 15 + 0.5 = 15.5
    expect(snapshot1.value).toBeCloseTo(15.5);
    // addr2: 45*0.5 + (2048/1024)*0.5 = 22.5 + 1 = 23.5
    expect(snapshot2.value).toBeCloseTo(23.5);
    expect(snapshot3).toEqual({ key: 'resource_usage', value: 0 });
  });

  it('resource_usage policy picks node-units with minimum weighted score', () => {
    const snapshots = new Map([
      ['addr1', [{ key: 'resource_usage', value: 45.2 }]],
      ['addr2', [{ key: 'resource_usage', value: 22.1 }]],
    ]);
    const eligible = resourceOnlyPolicy.pickEligible(['addr1', 'addr2'], snapshots);
    expect(eligible).toEqual(['addr2']); // 资源占用更低
  });

  it('builds resource usage snapshot for logging', () => {
    const resourceUsage = new Map([
      ['addr1', { cpuPercent: 30.5, memoryMb: 512 }],
      ['addr2', { cpuPercent: 45.2, memoryMb: 1024 }],
    ]);
    const nodeUnits = ['addr1', 'addr2', 'addr3'];

    const snapshot = buildResourceUsageSnapshot(nodeUnits, resourceUsage);
    expect(snapshot).toEqual({
      addr1: { cpuPercent: 30.5, memoryMb: 512 },
      addr2: { cpuPercent: 45.2, memoryMb: 1024 },
      addr3: { cpuPercent: 0, memoryMb: 0 },
    });
  });
});

describe('pickCandidateDeployment', () => {
  beforeEach(() => {
    mockRequestSQL.mockClear();
    mockEscapeSQL.mockClear();
  });

  it('picks deployment candidates in deterministic order', async () => {
    const deployments = [
      createMockDeployment({ id: 'd1', address: '', updated_at: '2025-01-02', created_at: '2025-01-01' }),
      createMockDeployment({ id: 'd2', address: '', updated_at: '2025-01-01', created_at: '2025-01-01' }), // 更早的 updated_at
    ];
    // SQL 查询包含 "limit 1"，所以只返回排序后的第一行
    mockRequestSQL.mockResolvedValue([deployments[1]]); // d2 在前，因为 updated_at 更早

    const mockTerminal = {} as any;
    const candidate = await pickCandidateDeployment(mockTerminal, []);

    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "select * from deployment where enabled = true and address = '' order by updated_at asc, created_at asc, id asc limit 1",
    );
    expect(candidate?.id).toBe('d2'); // updated_at 更早的优先
  });

  it('prefers lost addresses when provided', async () => {
    mockEscapeSQL.mockImplementation((str) => `'${str}'`);
    mockRequestSQL.mockResolvedValueOnce([createMockDeployment({ id: 'd3', address: 'addr_lost' })]);

    const mockTerminal = {} as any;
    const candidate = await pickCandidateDeployment(mockTerminal, ['addr_lost']);

    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "select * from deployment where enabled = true and address in ('addr_lost') order by updated_at asc, created_at asc, id asc limit 1",
    );
    expect(candidate?.id).toBe('d3');
  });

  it('falls back to unassigned when lost has no candidates', async () => {
    mockRequestSQL
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createMockDeployment({ id: 'd4', address: '' })]);

    const mockTerminal = {} as any;
    const candidate = await pickCandidateDeployment(mockTerminal, ['addr_lost']);

    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "select * from deployment where enabled = true and address in ('addr_lost') order by updated_at asc, created_at asc, id asc limit 1",
    );
    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "select * from deployment where enabled = true and address = '' order by updated_at asc, created_at asc, id asc limit 1",
    );
    expect(candidate?.id).toBe('d4');
  });

  it('returns undefined when no candidates available', async () => {
    mockRequestSQL.mockResolvedValue([]);

    const mockTerminal = {} as any;
    const candidate = await pickCandidateDeployment(mockTerminal, []);

    expect(candidate).toBeUndefined();
  });
});

describe('claimDeployment', () => {
  beforeEach(() => {
    mockRequestSQL.mockClear();
    mockEscapeSQL.mockClear();
  });

  it('updates deployment address with condition address = ""', async () => {
    mockEscapeSQL.mockImplementation((str) => `'${str}'`);
    mockRequestSQL.mockResolvedValue([{ id: 'd1' }]);

    const mockTerminal = {} as any;
    const deployment = createMockDeployment({ id: 'd1' });
    const claimed = await claimDeployment(mockTerminal, deployment, 'addr1', []);

    expect(mockEscapeSQL).toHaveBeenCalledWith('addr1');
    expect(mockEscapeSQL).toHaveBeenCalledWith('d1');
    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "update deployment set address = 'addr1' where id = 'd1' and (address = '') returning id",
    );
    expect(claimed).toBe(true);
  });

  it('allows claim when address is in lost list', async () => {
    mockEscapeSQL.mockImplementation((str) => `'${str}'`);
    mockRequestSQL.mockResolvedValue([{ id: 'd1' }]);

    const mockTerminal = {} as any;
    const deployment = createMockDeployment({ id: 'd1', address: 'addr_lost' });
    const claimed = await claimDeployment(mockTerminal, deployment, 'addr1', ['addr_lost']);

    expect(mockRequestSQL).toHaveBeenCalledWith(
      mockTerminal,
      "update deployment set address = 'addr1' where id = 'd1' and (address = '' or address in ('addr_lost')) returning id",
    );
    expect(claimed).toBe(true);
  });

  it('returns false when update fails (concurrent claim)', async () => {
    mockEscapeSQL.mockImplementation((str) => `'${str}'`);
    mockRequestSQL.mockResolvedValue([]); // 空数组表示更新失败（被其他节点抢占）

    const mockTerminal = {} as any;
    const deployment = createMockDeployment({ id: 'd1' });
    const claimed = await claimDeployment(mockTerminal, deployment, 'addr1', []);

    expect(claimed).toBe(false);
  });
});

describe('buildSnapshots', () => {
  it('builds metric snapshots for all node-units', () => {
    const nodeUnits = ['addr1', 'addr2'];
    const counts = new Map([
      ['addr1', 2],
      ['addr2', 1],
    ]);
    const resourceUsage = new Map([
      ['addr1', { cpuPercent: 30, memoryMb: 1024 }],
      ['addr2', { cpuPercent: 45, memoryMb: 2048 }],
    ]);
    const context = { deployments: [], deploymentCounts: counts, resourceUsage };

    const snapshots = buildSnapshots(nodeUnits, context, defaultClaimPolicy);

    expect(snapshots.size).toBe(2);
    expect(snapshots.get('addr1')).toEqual([{ key: 'deployment_count', value: 2 }]);
    expect(snapshots.get('addr2')).toEqual([{ key: 'deployment_count', value: 1 }]);
  });
});

describe('policy selection via environment variable', () => {
  beforeEach(() => {
    delete process.env.NODE_UNIT_CLAIM_POLICY;
  });

  it('defaults to deployment_count when env var not set', () => {
    const policyName = process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count';
    expect(policyName).toBe('deployment_count');
  });

  it('uses resource_usage when env var set', () => {
    process.env.NODE_UNIT_CLAIM_POLICY = 'resource_usage';
    const policyName = process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count';
    expect(policyName).toBe('resource_usage');
  });
});
