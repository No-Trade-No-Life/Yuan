# Test Spec: HTTP Proxy Service Testing Strategy

**基于**: Dev Spec - HTTP Proxy Service Implementation  
**目标读者**: 测试工程师、QA  
**状态**: Ready for Implementation

---

## 1. 测试目标

### 1.1 测试覆盖范围

- ✅ 单元测试：所有函数的独立逻辑
- ✅ 集成测试：Client-Server 端到端流程
- ✅ 边界测试：异常输入、错误处理
- ✅ 性能测试：并发、超时场景

### 1.2 覆盖率目标

- 代码覆盖率：\u003e 80%
- 分支覆盖率：\u003e 75%
- 关键路径：100%

---

## 2. 单元测试

### 2.1 `utils.test.ts` - Label 匹配逻辑

**测试文件路径**: `src/__tests__/utils.test.ts`

```typescript
import { matchLabelSelector } from '../utils';
import { IHTTPProxyLabelSelector } from '../types';

describe('matchLabelSelector', () => {
  const tags = {
    region: 'us-west',
    env: 'production',
    version: '1.0.0',
  };

  describe('matchLabels', () => {
    it('应该匹配精确的标签', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchLabels: { region: 'us-west' },
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('应该匹配多个标签（AND 逻辑）', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchLabels: { region: 'us-west', env: 'production' },
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('应该拒绝不匹配的标签', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchLabels: { region: 'us-east' },
      };
      expect(matchLabelSelector(tags, selector)).toBe(false);
    });

    it('应该拒绝部分匹配（AND 逻辑）', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchLabels: { region: 'us-west', env: 'staging' },
      };
      expect(matchLabelSelector(tags, selector)).toBe(false);
    });
  });

  describe('matchExpressions', () => {
    it('Exists: 应该检查标签存在性', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchExpressions: [{ key: 'region', operator: 'Exists' }],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('DoesNotExist: 应该检查标签不存在', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchExpressions: [{ key: 'nonexistent', operator: 'DoesNotExist' }],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('In: 应该检查值在列表中', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchExpressions: [{ key: 'region', operator: 'In', values: ['us-west', 'us-east'] }],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('NotIn: 应该检查值不在列表中', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchExpressions: [{ key: 'region', operator: 'NotIn', values: ['eu-west', 'ap-south'] }],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('应该组合多个表达式（AND 逻辑）', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchExpressions: [
          { key: 'region', operator: 'Exists' },
          { key: 'env', operator: 'In', values: ['production', 'staging'] },
        ],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });
  });

  describe('混合匹配', () => {
    it('应该同时满足 matchLabels 和 matchExpressions', () => {
      const selector: IHTTPProxyLabelSelector = {
        matchLabels: { region: 'us-west' },
        matchExpressions: [{ key: 'env', operator: 'In', values: ['production'] }],
      };
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });

    it('空 selector 应该匹配所有 tags', () => {
      const selector: IHTTPProxyLabelSelector = {};
      expect(matchLabelSelector(tags, selector)).toBe(true);
    });
  });
});
```

---

### 2.2 `server.test.ts` - Server 端逻辑

**测试文件路径**: `src/__tests__/server.test.ts`

```typescript
import { Terminal } from '@yuants/protocol';
import { provideHTTPProxyService } from '../server';
import { IHTTPProxyRequest } from '../types';

// Mock fetch
global.fetch = jest.fn();

describe('provideHTTPProxyService', () => {
  let terminal: Terminal;

  beforeEach(() => {
    terminal = new Terminal('ws://localhost:8888', {
      terminal_id: 'test-server',
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    terminal.dispose();
  });

  it('应该注册 HTTPProxy 服务', () => {
    const spy = jest.spyOn(terminal.server, 'provideService');

    provideHTTPProxyService(terminal, { region: 'us-west' });

    expect(spy).toHaveBeenCalledWith('HTTPProxy', expect.any(Object), expect.any(Function), undefined);
  });

  it('应该将 labels 注入到 terminal.terminalInfo.tags', () => {
    const labels = { region: 'us-west', ip: '1.2.3.4' };

    provideHTTPProxyService(terminal, labels);

    expect(terminal.terminalInfo.tags).toMatchObject(labels);
  });

  it('应该成功处理 GET 请求', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      url: 'https://api.example.com/data',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"result":"success"}',
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { dispose } = provideHTTPProxyService(terminal, {});

    // 模拟调用服务处理器
    const handler = (terminal.server as any)._mapMethodToService.get('HTTPProxy').handler;
    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
      method: 'GET',
    };

    const result = await handler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-1',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    expect(result.res.code).toBe(0);
    expect(result.res.data.status).toBe(200);
    expect(result.res.data.body).toBe('{"result":"success"}');

    dispose();
  });

  it('应该处理超时错误', async () => {
    // Mock AbortError
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    const { dispose } = provideHTTPProxyService(terminal, {});

    const handler = (terminal.server as any)._mapMethodToService.get('HTTPProxy').handler;
    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/slow',
      timeout: 100,
    };

    const result = await handler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-2',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    expect(result.res.code).toBe('TIMEOUT');

    dispose();
  });

  it('应该处理网络错误', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { dispose } = provideHTTPProxyService(terminal, {});

    const handler = (terminal.server as any)._mapMethodToService.get('HTTPProxy').handler;
    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/error',
    };

    const result = await handler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-3',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    expect(result.res.code).toBe('FETCH_FAILED');

    dispose();
  });
});
```

---

### 2.3 `client.test.ts` - Client 端逻辑

**测试文件路径**: `src/__tests__/client.test.ts`

```typescript
import { Terminal } from '@yuants/protocol';
import { requestHTTPProxy } from '../client';
import { IHTTPProxyRequest } from '../types';

describe('requestHTTPProxy', () => {
  let terminal: Terminal;

  beforeEach(() => {
    terminal = new Terminal('ws://localhost:8888', {
      terminal_id: 'test-client',
    });
  });

  afterEach(() => {
    terminal.dispose();
  });

  it('应该返回 NO_PROXY_AVAILABLE 当无可用代理时', async () => {
    jest.spyOn(terminal.client, 'servicesReady').mockResolvedValue();
    jest.spyOn(terminal.client, 'resolveTargetServices').mockResolvedValue([]);

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
    };

    const response = await requestHTTPProxy(terminal, request);

    expect(response.code).toBe('NO_PROXY_AVAILABLE');
  });

  it('应该选择第一个匹配的代理节点', async () => {
    const candidates = [
      { terminal_id: 'proxy-1', service_id: 's1' },
      { terminal_id: 'proxy-2', service_id: 's2' },
    ];

    jest.spyOn(terminal.client, 'servicesReady').mockResolvedValue();
    jest.spyOn(terminal.client, 'resolveTargetServices').mockResolvedValue(candidates);
    jest.spyOn(terminal.client, 'requestForResponse').mockResolvedValue({
      code: 0,
      message: 'OK',
      data: {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        ok: true,
        url: 'https://api.example.com/data',
      },
    });

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
    };

    await requestHTTPProxy(terminal, request);

    expect(terminal.client.requestForResponse).toHaveBeenCalledWith(
      'HTTPProxy',
      request,
      'proxy-1', // 选择第一个
    );
  });

  it('应该根据 labelSelector 过滤代理节点', async () => {
    const candidates = [
      { terminal_id: 'proxy-us-west', service_id: 's1' },
      { terminal_id: 'proxy-us-east', service_id: 's2' },
    ];

    terminal.terminalInfos = [
      {
        terminal_id: 'proxy-us-west',
        tags: { region: 'us-west' },
      },
      {
        terminal_id: 'proxy-us-east',
        tags: { region: 'us-east' },
      },
    ] as any;

    jest.spyOn(terminal.client, 'servicesReady').mockResolvedValue();
    jest.spyOn(terminal.client, 'resolveTargetServices').mockResolvedValue(candidates);
    jest.spyOn(terminal.client, 'requestForResponse').mockResolvedValue({
      code: 0,
      message: 'OK',
      data: {} as any,
    });

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
    };

    await requestHTTPProxy(terminal, request, {
      matchLabels: { region: 'us-east' },
    });

    expect(terminal.client.requestForResponse).toHaveBeenCalledWith(
      'HTTPProxy',
      request,
      'proxy-us-east', // 选择匹配的节点
    );
  });

  it('应该返回 NO_MATCHING_PROXY 当无匹配代理时', async () => {
    const candidates = [{ terminal_id: 'proxy-us-west', service_id: 's1' }];

    terminal.terminalInfos = [
      {
        terminal_id: 'proxy-us-west',
        tags: { region: 'us-west' },
      },
    ] as any;

    jest.spyOn(terminal.client, 'servicesReady').mockResolvedValue();
    jest.spyOn(terminal.client, 'resolveTargetServices').mockResolvedValue(candidates);

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
    };

    const response = await requestHTTPProxy(terminal, request, {
      matchLabels: { region: 'eu-west' }, // 不匹配
    });

    expect(response.code).toBe('NO_MATCHING_PROXY');
  });
});
```

---

## 3. 集成测试

### 3.1 端到端测试（本地 Host + 本地 HTTP Server）

**测试文件路径**: `src/__tests__/integration.test.ts`

```typescript
import { Terminal } from '@yuants/protocol';
import { createServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { provideHTTPProxyService } from '../server';
import { requestHTTPProxy } from '../client';
import { IHTTPProxyRequest } from '../types';

describe('Integration: Client → Proxy → HTTP', () => {
  let proxyTerminal1: Terminal;
  let proxyTerminal2: Terminal;
  let clientTerminal: Terminal;
  let httpServer: any;
  let httpServerPort: number;
  let hostProcess: any;
  const hostPort = 8888;

  beforeAll(async () => {
    // 1) 启动本地 HTTP Server
    httpServer = createServer((req, res) => {
      if (req.url === '/get') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, method: 'GET' }));
        return;
      }
      if (req.url === '/post' && req.method === 'POST') {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, method: 'POST', json: JSON.parse(data || '{}') }));
        });
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (typeof address === 'object' && address) {
          httpServerPort = address.port;
        }
        resolve();
      });
    });

    // 2) 启动 Host（app-host）
    const hostEntry = path.resolve(__dirname, '../../../../apps/host/src/index.ts');
    hostProcess = spawn(process.execPath, ['-r', 'ts-node/register', hostEntry], {
      env: { ...process.env, PORT: String(hostPort) },
      cwd: path.resolve(__dirname, '../../../../'),
      stdio: 'pipe',
    });

    // 等待 Host 启动
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3) 启动代理节点
    proxyTerminal1 = new Terminal(`ws://localhost:${hostPort}`, { terminal_id: 'proxy-us-west' });
    provideHTTPProxyService(proxyTerminal1, { region: 'us-west', id: '1' }, { allowedHosts: ['localhost'] });

    proxyTerminal2 = new Terminal(`ws://localhost:${hostPort}`, { terminal_id: 'proxy-us-east' });
    provideHTTPProxyService(proxyTerminal2, { region: 'us-east', id: '2' }, { allowedHosts: ['localhost'] });

    // 4) 启动客户端
    clientTerminal = new Terminal(`ws://localhost:${hostPort}`, { terminal_id: 'client-node' });

    // 等待服务注册
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, 20000);

  afterAll(async () => {
    proxyTerminal1.dispose();
    proxyTerminal2.dispose();
    clientTerminal.dispose();

    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    hostProcess.kill('SIGTERM');
  }, 20000);

  it('应该完成端到端 HTTP 请求', async () => {
    const request: IHTTPProxyRequest = {
      url: `http://localhost:${httpServerPort}/get`,
      method: 'GET',
    };

    const response = await requestHTTPProxy(clientTerminal, request);
    expect(response.code).toBe(0);
  }, 10000);

  it('应该支持 labels 路由', async () => {
    const request: IHTTPProxyRequest = {
      url: `http://localhost:${httpServerPort}/get`,
      labels: { region: 'us-west' },
    };

    const response = await requestHTTPProxy(clientTerminal, request);
    expect(response.code).toBe(0);
  }, 10000);

  it('应该支持 POST 请求', async () => {
    const request: IHTTPProxyRequest = {
      url: `http://localhost:${httpServerPort}/post`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    };

    const response = await requestHTTPProxy(clientTerminal, request);
    expect(response.code).toBe(0);
  }, 10000);
});
```

---

## 4. 性能测试

### 4.1 并发测试

```typescript
describe('Performance: Concurrency', () => {
  it('应该处理 100 个并发请求', async () => {
    const requests = Array.from({ length: 100 }, (_, i) => ({
      url: `https://httpbin.org/delay/0`,
      method: 'GET' as const,
    }));

    const startTime = Date.now();
    const responses = await Promise.all(requests.map((req) => requestHTTPProxy(clientTerminal, req)));
    const duration = Date.now() - startTime;

    expect(responses.every((r) => r.code === 0)).toBe(true);
    expect(duration).toBeLessThan(10000); // 10 秒内完成
  }, 15000);
});
```

### 4.2 超时测试

```typescript
describe('Performance: Timeout', () => {
  it('应该在超时后返回 TIMEOUT 错误', async () => {
    const request: IHTTPProxyRequest = {
      url: 'https://httpbin.org/delay/10',
      timeout: 1000, // 1 秒超时
    };

    const response = await requestHTTPProxy(clientTerminal, request);

    expect(response.code).toBe('TIMEOUT');
  }, 5000);
});
```

---

## 5. 边界测试

### 5.1 异常输入

```typescript
describe('Edge Cases: Invalid Input', () => {
  it('应该拒绝无效 URL', async () => {
    const request: IHTTPProxyRequest = {
      url: 'not-a-url',
    };

    const response = await requestHTTPProxy(clientTerminal, request);

    expect(response.code).not.toBe(0);
  });

  it('应该处理空 body', async () => {
    const request: IHTTPProxyRequest = {
      url: 'https://httpbin.org/post',
      method: 'POST',
      body: '',
    };

    const response = await requestHTTPProxy(clientTerminal, request);

    expect(response.code).toBe(0);
  });
});
```

---

## 6. 测试执行

### 6.1 运行测试

```bash
# 单元测试
npm run test

# 覆盖率报告
npm run test -- --coverage

# 集成测试（需要 Host 运行）
npm run test:integration
```

### 6.2 CI/CD 集成

- GitHub Actions: 每次 PR 自动运行测试
- 覆盖率报告上传到 Codecov

---

## 7. 验收标准

- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 代码覆盖率 \u003e 80%
- [ ] 无内存泄漏（长时间运行测试）
- [ ] 性能测试满足基准（100 并发 \u003c 10s）

---

**测试优先级**：

1. **P0（阻塞）**: 单元测试（utils, server, client）
2. **P1（重要）**: 集成测试（端到端）
3. **P2（建议）**: 性能测试、边界测试
