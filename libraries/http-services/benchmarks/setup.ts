import { Terminal } from '@yuants/protocol';
import { provideHTTPProxyService } from '../src/server';
import http from 'http';
import net from 'net';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Start local HTTP test server.
 */
export const startTestServer = (port: number = 3000): http.Server => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    // Light response
    if (url.pathname === '/light') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    // Medium response
    if (url.pathname === '/medium') {
      const data = { message: 'test', data: 'x'.repeat(10000) };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // Heavy response
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
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Host did not start on port ${port} within ${timeoutMs}ms`);
};

export const startHostProcess = async (): Promise<{ hostUrl: string; process: ChildProcess }> => {
  const hostPort = await getFreePort();
  const repoRoot = path.resolve(__dirname, '../../../');
  const hostEntry = path.resolve(repoRoot, 'apps/host/lib/index.js');
  const hostProcess = spawn(process.execPath, [hostEntry], {
    env: { ...process.env, PORT: String(hostPort) },
    cwd: repoRoot,
    stdio: 'ignore',
  });
  hostProcess.unref();
  await waitForPort(hostPort, 10000);
  return { hostUrl: `ws://localhost:${hostPort}`, process: hostProcess };
};

export const stopHostProcess = async (hostProcess: ChildProcess) => {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    hostProcess.once('exit', finish);
    hostProcess.kill('SIGTERM');
    setTimeout(() => {
      hostProcess.kill('SIGKILL');
    }, 2000);
    setTimeout(finish, 4000);
  });
};

/**
 * Start proxy terminal.
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
      concurrent: 100,
      allowedHosts: ['localhost'],
    },
  );

  // Wait for service registration.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return terminal;
};

/**
 * Start client terminal.
 */
export const startClientTerminal = async (hostUrl: string): Promise<Terminal> => {
  const terminal = new Terminal(hostUrl, {
    terminal_id: 'bench-client',
  });

  await terminal.client.servicesReady();

  return terminal;
};
