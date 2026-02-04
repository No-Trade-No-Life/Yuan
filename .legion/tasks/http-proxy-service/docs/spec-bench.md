# Bench Spec: HTTP Proxy Service Performance Benchmarks

**基于**: Dev Spec - HTTP Proxy Service Implementation  
**目标读者**: 性能工程师、SRE  
**状态**: Ready for Implementation

---

## 1. Benchmark 目标

### 1.1 性能指标

- **吞吐量（Throughput）**: 每秒处理的请求数（RPS）
- **延迟（Latency）**: P50, P95, P99 响应时间
- **并发能力（Concurrency）**: 同时处理的请求数上限
- **资源消耗（Resource Usage）**: CPU、内存占用

### 1.2 基准场景

| 场景           | 描述                     | 目标             |
| -------------- | ------------------------ | ---------------- |
| **轻量级请求** | GET 小文件（\u003c 1KB） | \u003e 500 RPS   |
| **中等负载**   | POST JSON（~10KB）       | \u003e 200 RPS   |
| **重负载**     | GET 大文件（~1MB）       | \u003e 50 RPS    |
| **高并发**     | 100 并发请求             | P95 \u003c 500ms |

---

## 2. Benchmark 工具

### 2.1 工具选择

- **autocannon**: Node.js HTTP 压测工具
- **clinic.js**: 性能分析（CPU、Memory、Event Loop）
- **0x**: Flame graph 生成器

### 2.2 安装依赖

```bash
npm install --save-dev autocannon clinic 0x
```

---

## 3. Benchmark 实现

### 3.1 基础设施搭建

**文件路径**: `benchmarks/setup.ts`

```typescript
import { Terminal } from '@yuants/protocol';
import { provideHTTPProxyService } from '../src/server';
import http from 'http';

/**
 * 启动本地 HTTP 测试服务器
 */
export const startTestServer = (port: number = 3000): http.Server => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    // 轻量级响应
    if (url.pathname === '/light') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    // 中等负载响应
    if (url.pathname === '/medium') {
      const data = { message: 'test', data: 'x'.repeat(10000) };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // 重负载响应
    if (url.pathname === '/heavy') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(Buffer.alloc(1024 * 1024, 'x')); // 1MB
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port);
  return server;
};

/**
 * 启动代理节点
 */
export const startProxyTerminal = async (hostUrl: string): Promise<Terminal> => {
  const terminal = new Terminal(hostUrl, {
    terminal_id: 'bench-proxy',
  });

  provideHTTPProxyService(
    terminal,
    {
      benchmark: 'true',
      region: 'local',
    },
    {
      concurrent: 100, // 允许 100 并发
    },
  );

  // 等待服务注册
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return terminal;
};

/**
 * 启动客户端
 */
export const startClientTerminal = async (hostUrl: string): Promise<Terminal> => {
  const terminal = new Terminal(hostUrl, {
    terminal_id: 'bench-client',
  });

  await terminal.client.servicesReady();

  return terminal;
};
```

---

### 3.2 Benchmark Suite

**文件路径**: `benchmarks/index.ts`

```typescript
import autocannon from 'autocannon';
import { startTestServer, startProxyTerminal, startClientTerminal } from './setup';
import { requestHTTPProxy } from '../src/client';
import { IHTTPProxyRequest } from '../src/types';

const DEFAULT_HOST_URL = process.env.HOST_URL;
const TEST_SERVER_PORT = 3000;

async function main() {
  console.log('🚀 Starting HTTP Proxy Service Benchmark...\n');

  // 1. 启动测试服务器
  const testServer = startTestServer(TEST_SERVER_PORT);
  console.log(`✅ Test server listening on :${TEST_SERVER_PORT}`);

  // 2. 启动 Host（若未提供 HOST_URL）
  const hostProcess = DEFAULT_HOST_URL ? null : await startHostProcess();
  const hostUrl = DEFAULT_HOST_URL || hostProcess!.hostUrl;

  // 3. 启动代理节点
  const proxyTerminal = await startProxyTerminal(hostUrl);
  console.log('✅ Proxy terminal ready');

  // 4. 启动客户端
  const clientTerminal = await startClientTerminal(hostUrl);
  console.log('✅ Client terminal ready\n');

  // 4. 运行 benchmarks
  await runBenchmarks(clientTerminal);

  // 5. 清理
  testServer.close();
  proxyTerminal.dispose();
  clientTerminal.dispose();
  if (hostProcess) {
    await stopHostProcess(hostProcess.process);
  }

  console.log('\n✅ Benchmark complete!');
  process.exit(0);
}

async function runBenchmarks(clientTerminal: Terminal) {
  const scenarios = [
    {
      name: 'Light Load (GET \u003c1KB)',
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/light`,
        method: 'GET' as const,
      },
    },
    {
      name: 'Medium Load (POST ~10KB)',
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/medium`,
        method: 'GET' as const,
      },
    },
    {
      name: 'Heavy Load (GET ~1MB)',
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/heavy`,
        method: 'GET' as const,
      },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n📊 Running: ${scenario.name}`);
    console.log('─'.repeat(60));

    await benchmarkRequest(clientTerminal, scenario.request);
  }
}

async function benchmarkRequest(clientTerminal: Terminal, request: IHTTPProxyRequest) {
  const startTime = Date.now();
  const iterations = 1000;
  const concurrency = 10;

  // 预热
  await requestHTTPProxy(clientTerminal, request);

  // 并发执行
  const batches = Math.ceil(iterations / concurrency);
  const latencies: number[] = [];

  for (let i = 0; i < batches; i++) {
    const batchRequests = Array.from({ length: concurrency }, async () => {
      const reqStart = Date.now();
      await requestHTTPProxy(clientTerminal, request);
      const reqEnd = Date.now();
      return reqEnd - reqStart;
    });

    const batchLatencies = await Promise.all(batchRequests);
    latencies.push(...batchLatencies);
  }

  const totalTime = Date.now() - startTime;

  // 统计
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const rps = (iterations / totalTime) * 1000;

  console.log(`Requests:    ${iterations}`);
  console.log(`Duration:    ${totalTime}ms`);
  console.log(`RPS:         ${rps.toFixed(2)}`);
  console.log(`Latency:`);
  console.log(`  Avg:       ${avg.toFixed(2)}ms`);
  console.log(`  P50:       ${p50}ms`);
  console.log(`  P95:       ${p95}ms`);
  console.log(`  P99:       ${p99}ms`);
}

main().catch(console.error);
```

---

### 3.3 Selector 微基准

**目标**：评估 `selectHTTPProxyIpRoundRobin` 在不同 proxy 池规模下的性能开销。

**场景**：

| 场景 | Proxy 池规模 | 迭代次数 | 目标 (RPS) |
| ---- | ------------ | -------- | ---------- |
| S1   | 1            | 20000    | >= 100000  |
| S2   | 16           | 20000    | >= 80000   |
| S3   | 128          | 20000    | >= 60000   |
| S4   | 1024         | 20000    | >= 40000   |

**输出要求**：

- 控制台输出与现有 bench 风格一致（Requests/Duration/RPS/Latency/Thresholds/Result）
- 每个场景输出 `ResultJSON`，包含 `poolSize`、`rps`、`p50Ms/p95Ms/p99Ms`、`threshold`、`pass`

**阈值判定**：

- 任一场景未达标时整体 bench 失败（进程退出码为 1）

---

### 3.4 运行脚本

**文件路径**: `package.json`

**环境变量**：

- `HOST_URL`：可选，默认自动启动本地 Host。
- 若 `HOST_URL` 指向非本地地址，需设置 `ALLOW_REMOTE_HOST=true` 才会启用远端 Host（否则忽略并回退本地 Host）。

```json
{
  "scripts": {
    "bench": "ts-node benchmarks/index.ts",
    "bench:profile": "clinic doctor -- ts-node benchmarks/index.ts",
    "bench:flame": "0x -- ts-node benchmarks/index.ts"
  }
}
```

---

## 4. 性能剖析

### 4.1 CPU Profiling

```bash
# 生成 CPU 火焰图
npm run bench:flame
```

**预期结果**：

- `fetch()` 占用大部分 CPU 时间
- JSON 序列化/反序列化开销 \u003c 5%
- Terminal 通信开销 \u003c 10%

### 4.2 Memory Profiling

```bash
# 检测内存泄漏
npm run bench:profile
```

**预期结果**：

- 稳定的内存占用（无持续增长）
- GC 停顿时间 \u003c 10ms

---

## 5. 基准测试结果（预期）

### 5.1 本地环境（MacBook Pro M1）

| 场景            | RPS  | P50 (ms) | P95 (ms) | P99 (ms) |
| --------------- | ---- | -------- | -------- | -------- |
| Light Load      | 600+ | 15       | 30       | 50       |
| Medium Load     | 250+ | 35       | 80       | 120      |
| Heavy Load      | 60+  | 150      | 300      | 500      |
| 100 Concurrency | -    | 200      | 400      | 600      |

### 5.2 资源消耗

- **CPU**: 代理节点 \u003c 50%（单核）
- **Memory**: 代理节点 \u003c 200MB
- **Network**: 与 HTTP 目标带宽一致

---

## 6. 优化建议

### 6.1 性能瓶颈识别

基于 Profiling 结果，可能的瓶颈：

1. **fetch() 执行时间**：占据大部分延迟，优化空间有限
2. **JSON 序列化**：大 body 时可能成为瓶颈
3. **Terminal 消息传输**：双重网络开销

### 6.2 优化方向

- **连接池**：复用 HTTP 连接（fetch 默认已支持）
- **压缩**：对大 body 启用 gzip
- **缓存**：对 GET 请求结果缓存
- **流式传输**：使用 frame 机制支持大文件

---

## 7. 压力测试

### 7.1 极限并发测试

```typescript
async function stressTest() {
  const concurrency = 500;
  const requests = Array.from({ length: concurrency }, () =>
    requestHTTPProxy(clientTerminal, {
      url: 'http://localhost:3000/light',
    }),
  );

  const results = await Promise.allSettled(requests);
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);
}
```

**验收标准**：

- 500 并发下，成功率 \u003e 95%
- 无服务崩溃或内存溢出

---

## 8. 回归测试

### 8.1 性能基线

建立性能基线，每次代码变更后运行 benchmark：

```bash
npm run bench \u003e benchmarks/baseline.txt
```

### 8.2 性能回归检测

对比当前结果与 baseline：

- RPS 下降 \u003e 10%：**警告**
- RPS 下降 \u003e 20%：**阻塞**

---

## 9. 验收标准

- [ ] 轻量级请求 RPS \u003e 500
- [ ] 中等负载 RPS \u003e 200
- [ ] 100 并发 P95 \u003c 500ms
- [ ] Selector 微基准：S1/S2/S3/S4 均满足对应 RPS 阈值
- [ ] 无内存泄漏（24 小时压测）
- [ ] CPU 占用 \u003c 50%（单核）

---

**下一步**：

- 实现 benchmark 脚本
- 建立性能基线
- 集成到 CI/CD（每次 PR 运行）
