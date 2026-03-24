import { IDeployment, IDeploymentAssignment } from '@yuants/deploy';
import { ITerminalInfo } from '@yuants/protocol';

const mockRequestSQL = jest.fn();
const mockEscapeSQL = jest.fn((value) => `'${value}'`);

jest.mock('@yuants/sql', () => ({
  requestSQL: mockRequestSQL,
  escapeSQL: mockEscapeSQL,
}));

import {
  buildDaemonAssignmentId,
  buildDeploymentAssignmentId,
  claimDeployment,
  defaultClaimPolicy,
  deriveDeploymentAddress,
  getLostAddresses,
  getRollbackBlockers,
  isAssignmentActiveAt,
  loadActiveNodeStates,
  loadActiveNodeUnits,
  matchSelector,
  parseSelector,
  pickCandidateDeployment,
  shouldUseAssignmentSource,
} from './scheduler';

const createMockDeployment = (overrides: Partial<IDeployment> = {}): IDeployment => ({
  id: 'deployment-id',
  package_name: '@yuants/example',
  package_version: '1.0.0',
  command: '',
  args: [],
  env: {},
  type: 'deployment',
  desired_replicas: 1,
  selector: '',
  lease_ttl_seconds: 60,
  heartbeat_interval_seconds: 15,
  paused: false,
  observed_generation: 0,
  spec_hash: '',
  address: '',
  enabled: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockAssignment = (overrides: Partial<IDeploymentAssignment> = {}): IDeploymentAssignment => ({
  assignment_id: 'deployment-id#0',
  deployment_id: 'deployment-id',
  node_id: 'node-a',
  replica_index: 0,
  lease_holder: 'node-a',
  lease_expire_at: '2026-01-01T00:01:00.000Z',
  heartbeat_at: null,
  exit_reason: '',
  state: 'Assigned',
  generation: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('selector helpers', () => {
  it('parses valid selector fragments', () => {
    expect(parseSelector('region=cn,env=prod')).toEqual({ labels: { region: 'cn', env: 'prod' } });
  });

  it('rejects invalid selector syntax', () => {
    expect(parseSelector('region=cn, env=prod')).toEqual({ error_code: 'E_SELECTOR_INVALID' });
    expect(parseSelector('region in (cn)')).toEqual({ error_code: 'E_SELECTOR_INVALID' });
  });

  it('matches daemon selectors against node labels', () => {
    expect(matchSelector('region=cn,env=prod', { region: 'cn', env: 'prod', node_unit: 'true' })).toBe(true);
    expect(matchSelector('region=cn,env=prod', { region: 'us', env: 'prod' })).toBe(false);
  });
});

describe('node activity helpers', () => {
  const now = Date.parse('2026-01-01T00:00:30.000Z');

  it('loads only active node-unit infos within ttl', () => {
    const infos: ITerminalInfo[] = [
      {
        terminal_id: 't1',
        updated_at: now - 5_000,
        tags: { node_unit: 'true', node_unit_address: 'node-a', region: 'cn', applied_generation: '2' },
      } as ITerminalInfo,
      {
        terminal_id: 't2',
        updated_at: now - 40_000,
        tags: { node_unit: 'true', node_unit_address: 'node-b', region: 'us' },
      } as ITerminalInfo,
    ];

    expect(loadActiveNodeUnits(infos)).toEqual([]);

    const states = loadActiveNodeStates(infos, now, 30);
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({
      node_id: 'node-a',
      terminal_id: 't1',
      applied_generation: 2,
    });
  });
});

describe('assignment helpers', () => {
  const now = Date.parse('2026-01-01T00:00:30.000Z');

  it('treats lease_expire_at as the single active truth', () => {
    expect(isAssignmentActiveAt(createMockAssignment(), now)).toBe(true);
    expect(
      isAssignmentActiveAt(
        createMockAssignment({
          lease_expire_at: '2026-01-01T00:00:10.000Z',
          heartbeat_at: '2026-01-01T00:00:29.000Z',
        }),
        now,
      ),
    ).toBe(false);
  });

  it('derives address only from exactly one effective assignment', () => {
    const deployment = createMockDeployment({ id: 'dep-1', address: 'stale-node' });
    expect(
      deriveDeploymentAddress(
        deployment,
        [createMockAssignment({ deployment_id: 'dep-1', node_id: 'node-a' })],
        now,
      ),
    ).toBe('node-a');
    expect(
      deriveDeploymentAddress(
        deployment,
        [
          createMockAssignment({ deployment_id: 'dep-1', node_id: 'node-a' }),
          createMockAssignment({
            assignment_id: 'dep-1#1',
            deployment_id: 'dep-1',
            node_id: 'node-b',
            replica_index: 1,
          }),
        ],
        now,
      ),
    ).toBe('');
  });

  it('uses assignment source for fencing when any effective assignment exists', () => {
    expect(shouldUseAssignmentSource([], now)).toBe(false);
    expect(shouldUseAssignmentSource([createMockAssignment()], now)).toBe(true);
  });

  it('builds stable assignment ids', () => {
    expect(buildDeploymentAssignmentId('dep-1', 0)).toBe('dep-1#0');
    expect(buildDaemonAssignmentId('dep-1', 'node-a')).toBe('dep-1#node-a');
  });
});

describe('rollback and phase gates', () => {
  const now = Date.parse('2026-01-01T00:00:30.000Z');

  it('blocks rollback when daemon selector is non-empty', () => {
    const blockers = getRollbackBlockers(
      [createMockDeployment({ id: 'daemon-1', type: 'daemon', selector: 'region=cn' })],
      [],
      now,
    );
    expect(blockers).toEqual([{ error_code: 'E_ROLLBACK_BLOCKED_SELECTOR', deployment_id: 'daemon-1' }]);
  });

  it('blocks rollback when desired replicas exceed phase-a', () => {
    const blockers = getRollbackBlockers(
      [createMockDeployment({ id: 'dep-1', desired_replicas: 2 })],
      [],
      now,
    );
    expect(blockers).toEqual([{ error_code: 'E_ROLLBACK_BLOCKED_REPLICAS', deployment_id: 'dep-1' }]);
  });

  it('blocks rollback when paused deployment is enabled', () => {
    const blockers = getRollbackBlockers([createMockDeployment({ id: 'dep-1', paused: true })], [], now);
    expect(blockers).toEqual([{ error_code: 'E_ROLLBACK_BLOCKED_PAUSED', deployment_id: 'dep-1' }]);
  });

  it('blocks rollback when derived address is not converged', () => {
    const blockers = getRollbackBlockers(
      [createMockDeployment({ id: 'dep-1', address: 'node-b' })],
      [createMockAssignment({ deployment_id: 'dep-1', node_id: 'node-a' })],
      now,
    );
    expect(blockers).toEqual([{ error_code: 'E_ROLLBACK_NOT_CONVERGED_ADDRESS', deployment_id: 'dep-1' }]);
  });
});

describe('legacy claim helpers', () => {
  beforeEach(() => {
    mockRequestSQL.mockReset();
    mockEscapeSQL.mockClear();
  });

  it('detects lost addresses for legacy deployments', () => {
    const deployments = [
      createMockDeployment({ id: 'dep-1', address: 'node-a' }),
      createMockDeployment({ id: 'dep-2', address: 'node-b' }),
      createMockDeployment({ id: 'daemon-1', type: 'daemon', address: 'node-c' }),
    ];
    expect(getLostAddresses(deployments, ['node-a'])).toEqual(['node-b']);
  });

  it('picks lost-address candidates before empty address', async () => {
    mockRequestSQL.mockResolvedValueOnce([createMockDeployment({ id: 'dep-1', address: 'node-lost' })]);
    const candidate = await pickCandidateDeployment({} as never, ['node-lost']);
    expect(candidate?.id).toBe('dep-1');
  });

  it('claims only empty or lost legacy addresses', async () => {
    mockRequestSQL.mockResolvedValueOnce([{ id: 'dep-1' }]);
    const claimed = await claimDeployment({} as never, createMockDeployment({ id: 'dep-1' }), 'node-a', [
      'node-b',
    ]);
    expect(claimed).toBe(true);
    expect(mockRequestSQL).toHaveBeenCalledWith(
      {},
      "update deployment set address = 'node-a' where id = 'dep-1' and type = 'deployment' and (address = '' or address in ('node-b')) returning id",
    );
  });

  it('keeps deployment_count policy deterministic for ties', () => {
    const eligible = defaultClaimPolicy.pickEligible(
      ['node-a', 'node-b', 'node-c'],
      new Map([
        ['node-a', [{ key: 'deployment_count', value: 2 }]],
        ['node-b', [{ key: 'deployment_count', value: 1 }]],
        ['node-c', [{ key: 'deployment_count', value: 1 }]],
      ]),
    );
    expect(eligible).toEqual(['node-b', 'node-c']);
  });
});
