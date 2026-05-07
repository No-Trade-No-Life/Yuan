import { createReadStream, existsSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import { handleProxyRequest, toProxyConfig } from './request-proxy.mjs';

const port = Number(process.env.PORT || 4173);
const proxyConfig = toProxyConfig(process.env);
const distRoot = join(process.cwd(), 'dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const appConfig = () => ({
  envProfile: process.env.SIGNAL_TRADER_ENV_PROFILE || 'paper',
  hostLabel: process.env.SIGNAL_TRADER_HOST_LABEL || proxyConfig.hostOrigin,
  hostOrigin: proxyConfig.hostOrigin,
  enableMutation: process.env.SIGNAL_TRADER_ENABLE_MUTATION === '1',
  defaultRuntimeId: process.env.SIGNAL_TRADER_DEFAULT_RUNTIME_ID || '',
});

const sendJson = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

const serveStatic = async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requestedPath).replace(/^\/+/, '').replace(/^\.+/, '');
  const target = join(distRoot, safePath);
  const fallback = join(distRoot, 'index.html');
  const actual = existsSync(target) ? target : fallback;
  const fileStat = await stat(actual);
  res.writeHead(200, {
    'Content-Type': contentTypes[extname(actual)] || 'application/octet-stream',
    'Content-Length': fileStat.size,
  });
  createReadStream(actual).pipe(res);
};

if (!existsSync(join(distRoot, 'index.html'))) {
  console.error('dist/index.html 不存在，请先运行 npm run build');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return sendJson(res, 400, { error: 'EMPTY_URL' });
  if (req.url === '/healthz') return sendJson(res, 200, { ok: true });
  if (req.url === '/app-config.json') return sendJson(res, 200, appConfig());
  if (req.url.startsWith('/request')) return handleProxyRequest(req, res, proxyConfig);
  try {
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, '127.0.0.1', async () => {
  const indexHtml = await readFile(join(distRoot, 'index.html'), 'utf8');
  console.log(
    JSON.stringify({
      port,
      hostOrigin: proxyConfig.hostOrigin,
      hasToken: Boolean(proxyConfig.hostToken),
      indexBytes: Buffer.byteLength(indexHtml),
    }),
  );
});
