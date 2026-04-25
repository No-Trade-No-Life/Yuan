import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleProxyRequest, toProxyConfig } from './scripts/request-proxy.mjs';

const toAppConfig = (env: Record<string, string>) => ({
  envProfile: env.SIGNAL_TRADER_ENV_PROFILE || 'paper',
  hostLabel: env.SIGNAL_TRADER_HOST_LABEL || env.SIGNAL_TRADER_HOST_ORIGIN || 'local host',
  hostOrigin: env.SIGNAL_TRADER_HOST_ORIGIN || 'http://127.0.0.1:8888',
  enableMutation: env.SIGNAL_TRADER_ENABLE_MUTATION === '1',
  defaultRuntimeId: env.SIGNAL_TRADER_DEFAULT_RUNTIME_ID || '',
});

const runtimeConfigPlugin = (env: Record<string, string>): Plugin => ({
  name: 'signal-trader-runtime-config',
  configureServer(server) {
    server.middlewares.use('/app-config.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(toAppConfig(env)));
    });
    server.middlewares.use('/request', (req, res, next) => {
      handleProxyRequest(req, res, toProxyConfig(env)).catch(next);
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), runtimeConfigPlugin(env)],
    server: {
      host: '127.0.0.1',
      port: Number(env.PORT || 4173),
    },
  };
});
