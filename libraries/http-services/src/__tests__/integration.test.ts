import { Terminal } from '@yuants/protocol';
import { provideHTTPProxyService } from '../server';
import { fetch } from '../client';
import { createServer, Server } from 'http';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';

(process.env.CI_RUN ? describe.skip : describe)('Integration: Client → Proxy → HTTP', () => {
  let proxyTerminal1: Terminal;
  let proxyTerminal2: Terminal;
  let clientTerminal: Terminal;
  let httpServer: Server;
  let httpServerPort: number;
  let hostProcess: ChildProcess | null = null;
  let hostPort: number;

  const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getFreePort = async (): Promise<number> => {
    return await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to acquire free port')));
        }
      });
    });
  };

  const waitForPort = async (port: number, timeoutMs: number) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      let connected = false;
      await new Promise<void>((resolve) => {
        const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
          connected = true;
          socket.end();
          resolve();
        });
        socket.on('error', () => {
          socket.destroy();
          resolve();
        });
      });

      if (connected) return;
      await waitFor(200);
    }
    throw new Error(`Host did not start on port ${port} within ${timeoutMs}ms`);
  };

  beforeAll(async () => {
    const repoRoot = path.resolve(__dirname, '../../../../');
    const packageRoot = path.resolve(__dirname, '..', '..');
    const nodePath = path.resolve(repoRoot, 'common/temp/node_modules');
    // Start local HTTP server
    httpServer = createServer((req, res) => {
      if (req.url === '/get') {
        const body = JSON.stringify({ ok: true, method: 'GET' });
        res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(body);
        return;
      }

      if (req.url === '/post' && req.method === 'POST') {
        let data = '';
        req.on('data', (chunk) => {
          data += chunk;
        });
        req.on('end', () => {
          const body = JSON.stringify({ ok: true, method: 'POST', json: JSON.parse(data || '{}') });
          res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
          res.end(body);
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
        httpServer.unref();
        resolve();
      });
    });

    // Start Host process via ts-node
    hostPort = await getFreePort();
    const hostEntry = path.resolve(repoRoot, 'apps/host/lib/index.js');
    hostProcess = spawn(process.execPath, [hostEntry], {
      env: { ...process.env, PORT: String(hostPort), NODE_PATH: nodePath },
      cwd: repoRoot,
      stdio: 'ignore',
    });

    hostProcess?.unref();

    await waitForPort(hostPort, 10000);

    // Start Proxy Node 1 (us-west)
    proxyTerminal1 = new Terminal(`ws://localhost:${hostPort}`, {
      terminal_id: 'proxy-us-west',
    });
    provideHTTPProxyService(
      proxyTerminal1,
      {
        region: 'us-west',
        id: '1',
      },
      {
        allowedHosts: ['localhost'],
      },
    );

    // Start Proxy Node 2 (us-east)
    proxyTerminal2 = new Terminal(`ws://localhost:${hostPort}`, {
      terminal_id: 'proxy-us-east',
    });
    provideHTTPProxyService(
      proxyTerminal2,
      {
        region: 'us-east',
        id: '2',
      },
      {
        allowedHosts: ['localhost'],
      },
    );

    // Start Client
    clientTerminal = new Terminal(`ws://localhost:${hostPort}`, {
      terminal_id: 'client-node',
    });

    // Wait for service registration and discovery
    await waitFor(2000);
  }, 20000);

  afterAll(async () => {
    proxyTerminal1?.dispose();
    proxyTerminal2?.dispose();
    clientTerminal?.dispose();

    await new Promise<void>((resolve) => httpServer.close(() => resolve()));

    if (hostProcess) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        hostProcess?.once('exit', finish);
        hostProcess?.kill('SIGTERM');
        setTimeout(() => {
          hostProcess?.kill('SIGKILL');
        }, 2000);
        setTimeout(finish, 4000);
      });
      hostProcess = null;
    }

    if (process.env.DEBUG_OPEN_HANDLES === 'true') {
      const handles = (process as any)._getActiveHandles?.() || [];
      const requests = (process as any)._getActiveRequests?.() || [];
      const handleSummary = handles.map((handle: any) => handle?.constructor?.name || 'Unknown');
      console.info('[DEBUG_OPEN_HANDLES] handles:', handleSummary);
      console.info('[DEBUG_OPEN_HANDLES] requests:', requests.length);
    }
  }, 20000);

  it('should complete end-to-end HTTP request', async () => {
    const response = await fetch(`http://localhost:${httpServerPort}/get`, {
      method: 'GET',
      headers: { Connection: 'close' },
      terminal: clientTerminal,
    });

    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
  }, 10000);

  it('should route to correct proxy based on labels', async () => {
    const response = await fetch(`http://localhost:${httpServerPort}/get`, {
      labels: { region: 'us-west' },
      headers: { Connection: 'close' },
      terminal: clientTerminal,
    });
    expect(response.ok).toBe(true);
  }, 10000);

  it('should fail if no proxy matches labels', async () => {
    await expect(
      fetch(`http://localhost:${httpServerPort}/get`, {
        labels: { region: 'eu-central' },
        headers: { Connection: 'close' },
        terminal: clientTerminal,
      }),
    ).rejects.toBeTruthy();
  }, 10000);

  it('should support POST request', async () => {
    const response = await fetch(`http://localhost:${httpServerPort}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({ test: 'data' }),
      terminal: clientTerminal,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { json: { test: string } };
    expect(body.json).toEqual({ test: 'data' });
  }, 10000);
});
