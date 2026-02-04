import { Terminal, type ITerminalInfo } from '@yuants/protocol';
import { ReplaySubject } from 'rxjs';
import {
  startTestServer,
  startProxyTerminal,
  startClientTerminal,
  startHostProcess,
  stopHostProcess,
} from './setup';
import { fetch } from '../src/client';
import { selectHTTPProxyIpRoundRobin } from '../src/proxy-ip';

const DEFAULT_HOST_URL = process.env.HOST_URL;
const ALLOW_REMOTE_HOST = process.env.ALLOW_REMOTE_HOST === 'true';
const TEST_SERVER_PORT = 3000;
const ITERATIONS = 1000;
const CONCURRENCY = 10;
const HIGH_CONCURRENCY = 100;
const WARMUP_REQUESTS = 1;
const SELECTOR_POOL_SIZES = [1, 16, 128, 1024];
const SELECTOR_ITERATIONS = 20000;
const SELECTOR_WARMUP = 1000;
const SELECTOR_THRESHOLDS: Record<number, { rps: number }> = {
  1: { rps: 100000 },
  16: { rps: 80000 },
  128: { rps: 60000 },
  1024: { rps: 40000 },
};
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
  console.log(`Selector Pool Sizes: ${SELECTOR_POOL_SIZES.join(', ')}`);
  console.log(`Selector Iterations: ${SELECTOR_ITERATIONS}`);
  console.log(`Selector Warmup: ${SELECTOR_WARMUP}`);
  console.log('');

  // 1. Start test server
  const testServer = startTestServer(TEST_SERVER_PORT);
  console.log(`Test server listening on :${TEST_SERVER_PORT}`);

  // 2. Start host (if not provided)
  const shouldUseRemote = DEFAULT_HOST_URL && (ALLOW_REMOTE_HOST || isLocalHostUrl(DEFAULT_HOST_URL));
  if (DEFAULT_HOST_URL && !shouldUseRemote) {
    console.warn('HOST_URL is not local; ignoring unless ALLOW_REMOTE_HOST=true.');
  }
  const hostProcess = shouldUseRemote ? null : await startHostProcess();
  const hostUrl = shouldUseRemote ? DEFAULT_HOST_URL! : hostProcess!.hostUrl;

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
  process.exit(process.exitCode ?? 0);
}

async function runBenchmarks(clientTerminal: Terminal) {
  const scenarios = [
    {
      name: 'Light Load (GET <1KB)',
      threshold: THRESHOLDS.light,
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      input: `http://localhost:${TEST_SERVER_PORT}/light`,
      init: {
        method: 'GET' as const,
      },
    },
    {
      name: 'Medium Load (POST ~10KB)',
      threshold: THRESHOLDS.medium,
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      input: `http://localhost:${TEST_SERVER_PORT}/medium`,
      init: {
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
      input: `http://localhost:${TEST_SERVER_PORT}/heavy`,
      init: {
        method: 'GET' as const,
      },
    },
    {
      name: 'High Concurrency (100)',
      threshold: THRESHOLDS.highConcurrency,
      concurrency: HIGH_CONCURRENCY,
      iterations: ITERATIONS,
      input: `http://localhost:${TEST_SERVER_PORT}/light`,
      init: {
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
      scenario.input,
      scenario.init,
      scenario.iterations,
      scenario.concurrency,
      scenario.threshold,
    );
    results.push({ name: scenario.name, pass: result.pass });
  }

  const selectorResults = runSelectorBenchmarks();
  results.push(...selectorResults);

  return results;
}

async function benchmarkRequest(
  clientTerminal: Terminal,
  input: Request | string | URL,
  init: RequestInit | undefined,
  iterations: number,
  concurrency: number,
  threshold: { rps?: number; p95Ms?: number },
) {
  const startTime = Date.now();

  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    await ensureSuccess(clientTerminal, input, init);
  }

  // Concurrent run
  const batches = Math.ceil(iterations / concurrency);
  const latencies: number[] = [];

  for (let i = 0; i < batches; i++) {
    const batchRequests = Array.from({ length: concurrency }, async () => {
      const reqStart = Date.now();
      await ensureSuccess(clientTerminal, input, init);
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

async function ensureSuccess(terminal: Terminal, input: Request | string | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    terminal,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

function runSelectorBenchmarks() {
  const results: Array<{ name: string; pass: boolean }> = [];
  console.log('\nRunning: Selector Round Robin Microbench');
  console.log('------------------------------------------------------------');

  for (const poolSize of SELECTOR_POOL_SIZES) {
    const terminal = createSelectorTerminal(poolSize);
    const threshold = SELECTOR_THRESHOLDS[poolSize];
    const result = benchmarkSelector(terminal, poolSize, SELECTOR_ITERATIONS, threshold);
    results.push({ name: result.name, pass: result.pass });
  }

  return results;
}

function createSelectorTerminal(poolSize: number): Terminal {
  const terminalInfos$ = new ReplaySubject<ITerminalInfo[]>(1);
  const terminalInfos = buildProxyTerminalInfos(poolSize);
  terminalInfos$.next(terminalInfos);
  return {
    terminal_id: `bench-selector-${poolSize}`,
    terminalInfos,
    terminalInfos$,
  } as unknown as Terminal;
}

function buildProxyTerminalInfos(poolSize: number): ITerminalInfo[] {
  const infos: ITerminalInfo[] = [];
  for (let i = 0; i < poolSize; i++) {
    const third = Math.floor(i / 250);
    const fourth = (i % 250) + 1;
    const ip = `10.0.${third}.${fourth}`;
    infos.push({
      terminal_id: `bench-proxy-${i + 1}`,
      serviceInfo: {
        HTTPProxy: {
          service_id: 'HTTPProxy',
          method: 'HTTPProxy',
          schema: { type: 'object' },
        },
      },
      tags: {
        ip,
        ip_source: 'http-services',
      },
    });
  }
  return infos;
}

function benchmarkSelector(
  terminal: Terminal,
  poolSize: number,
  iterations: number,
  threshold: { rps: number },
) {
  for (let i = 0; i < SELECTOR_WARMUP; i++) {
    selectHTTPProxyIpRoundRobin(terminal);
  }

  const latencies: number[] = [];
  const totalStart = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    const opStart = process.hrtime.bigint();
    selectHTTPProxyIpRoundRobin(terminal);
    const opEnd = process.hrtime.bigint();
    latencies.push(Number(opEnd - opStart) / 1e6);
  }
  const totalMs = Number(process.hrtime.bigint() - totalStart) / 1e6;
  const rps = (iterations / totalMs) * 1000;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const pass = rps >= threshold.rps;
  const name = `Selector Round Robin (Pool ${poolSize})`;

  console.log(`\nRunning: ${name}`);
  console.log(`Pool Size:   ${poolSize}`);
  console.log(`Requests:    ${iterations}`);
  console.log(`Duration:    ${totalMs.toFixed(2)}ms`);
  console.log(`RPS:         ${rps.toFixed(2)}`);
  console.log(`Latency:`);
  console.log(`  Avg:       ${avg.toFixed(4)}ms`);
  console.log(`  P50:       ${p50.toFixed(4)}ms`);
  console.log(`  P95:       ${p95.toFixed(4)}ms`);
  console.log(`  P99:       ${p99.toFixed(4)}ms`);
  console.log(`Thresholds:  rps>=${threshold.rps}`);
  console.log(`Result:      ${pass ? 'PASS' : 'FAIL'}`);
  console.log(
    `ResultJSON:  ${JSON.stringify({
      name,
      poolSize,
      iterations,
      rps: Number(rps.toFixed(2)),
      avgMs: Number(avg.toFixed(4)),
      p50Ms: Number(p50.toFixed(4)),
      p95Ms: Number(p95.toFixed(4)),
      p99Ms: Number(p99.toFixed(4)),
      threshold,
      pass,
    })}`,
  );

  return { name, pass };
}

main().catch(console.error);

function isLocalHostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
