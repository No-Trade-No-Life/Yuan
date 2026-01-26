import { Terminal } from '@yuants/protocol';
import {
  startTestServer,
  startProxyTerminal,
  startClientTerminal,
  startHostProcess,
  stopHostProcess,
} from './setup';
import { requestHTTPProxy } from '../src/client';
import { IHTTPProxyRequest } from '../src/types';

const DEFAULT_HOST_URL = process.env.HOST_URL;
const TEST_SERVER_PORT = 3000;
const ITERATIONS = 1000;
const CONCURRENCY = 10;
const HIGH_CONCURRENCY = 100;
const WARMUP_REQUESTS = 1;
const THRESHOLDS = {
  light: { rps: 500 },
  medium: { rps: 200 },
  heavy: { rps: 50 },
  highConcurrency: { p95Ms: 500 },
};

async function main() {
  console.log('Starting HTTP Proxy Service Benchmark.');
  console.log(`Host: ${DEFAULT_HOST_URL || 'local host (auto-start)'}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`High Concurrency: ${HIGH_CONCURRENCY}`);
  console.log(`Warmup Requests: ${WARMUP_REQUESTS}`);
  console.log('');

  // 1. Start test server
  const testServer = startTestServer(TEST_SERVER_PORT);
  console.log(`Test server listening on :${TEST_SERVER_PORT}`);

  // 2. Start host (if not provided)
  const hostProcess = DEFAULT_HOST_URL ? null : await startHostProcess();
  const hostUrl = DEFAULT_HOST_URL || hostProcess!.hostUrl;

  // 3. Start proxy terminal
  const proxyTerminal = await startProxyTerminal(hostUrl);
  console.log('Proxy terminal ready');

  // 4. Start client terminal
  const clientTerminal = await startClientTerminal(hostUrl);
  console.log('Client terminal ready');
  console.log('');

  // 4. Run benchmarks
  const results = await runBenchmarks(clientTerminal);

  // 5. Cleanup
  testServer.close();
  proxyTerminal.dispose();
  clientTerminal.dispose();
  if (hostProcess) {
    await stopHostProcess(hostProcess.process);
  }

  const failed = results.some((result) => !result.pass);
  console.log('');
  console.log(`Benchmark complete. ${failed ? 'FAIL' : 'PASS'}`);
  process.exitCode = failed ? 1 : 0;
}

async function runBenchmarks(clientTerminal: Terminal) {
  const scenarios = [
    {
      name: 'Light Load (GET <1KB)',
      threshold: THRESHOLDS.light,
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/light`,
        method: 'GET' as const,
      },
    },
    {
      name: 'Medium Load (POST ~10KB)',
      threshold: THRESHOLDS.medium,
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/medium`,
        method: 'POST' as const,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', data: 'x'.repeat(10000) }),
      },
    },
    {
      name: 'Heavy Load (GET ~1MB)',
      threshold: THRESHOLDS.heavy,
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/heavy`,
        method: 'GET' as const,
      },
    },
    {
      name: 'High Concurrency (100)',
      threshold: THRESHOLDS.highConcurrency,
      concurrency: HIGH_CONCURRENCY,
      iterations: ITERATIONS,
      request: {
        url: `http://localhost:${TEST_SERVER_PORT}/light`,
        method: 'GET' as const,
      },
    },
  ];
  const results: Array<{ name: string; pass: boolean }> = [];

  for (const scenario of scenarios) {
    console.log(`\nRunning: ${scenario.name}`);
    console.log('------------------------------------------------------------');

    const result = await benchmarkRequest(
      clientTerminal,
      scenario.request,
      scenario.iterations,
      scenario.concurrency,
      scenario.threshold,
    );
    results.push({ name: scenario.name, pass: result.pass });
  }

  return results;
}

async function benchmarkRequest(
  clientTerminal: Terminal,
  request: IHTTPProxyRequest,
  iterations: number,
  concurrency: number,
  threshold: { rps?: number; p95Ms?: number },
) {
  const startTime = Date.now();

  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    await ensureSuccess(clientTerminal, request);
  }

  // Concurrent run
  const batches = Math.ceil(iterations / concurrency);
  const latencies: number[] = [];

  for (let i = 0; i < batches; i++) {
    const batchRequests = Array.from({ length: concurrency }, async () => {
      const reqStart = Date.now();
      await ensureSuccess(clientTerminal, request);
      const reqEnd = Date.now();
      return reqEnd - reqStart;
    });

    const batchLatencies = await Promise.all(batchRequests);
    latencies.push(...batchLatencies);
  }

  const totalTime = Date.now() - startTime;

  // Stats
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const rps = (iterations / totalTime) * 1000;

  const passRps = threshold.rps === undefined ? true : rps >= threshold.rps;
  const passP95 = threshold.p95Ms === undefined ? true : p95 <= threshold.p95Ms;
  const pass = passRps && passP95;

  console.log(`Requests:    ${iterations}`);
  console.log(`Duration:    ${totalTime}ms`);
  console.log(`RPS:         ${rps.toFixed(2)}`);
  console.log(`Latency:`);
  console.log(`  Avg:       ${avg.toFixed(2)}ms`);
  console.log(`  P50:       ${p50}ms`);
  console.log(`  P95:       ${p95}ms`);
  console.log(`  P99:       ${p99}ms`);
  console.log(`Thresholds:  rps>=${threshold.rps ?? 'n/a'}, p95<=${threshold.p95Ms ?? 'n/a'}ms`);
  console.log(`Result:      ${pass ? 'PASS' : 'FAIL'}`);
  console.log(
    `ResultJSON:  ${JSON.stringify({
      iterations,
      concurrency,
      rps: Number(rps.toFixed(2)),
      avgMs: Number(avg.toFixed(2)),
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      threshold,
      pass,
    })}`,
  );

  return { pass };
}

async function ensureSuccess(terminal: Terminal, request: IHTTPProxyRequest) {
  const response = await requestHTTPProxy(terminal, request);
  if (!response || response.code !== 0) {
    const code = response?.code ?? 'UNKNOWN';
    const message = response?.message ?? 'Unknown error';
    throw new Error(`Request failed: ${code} ${message}`);
  }
  return response;
}

main().catch(console.error);
