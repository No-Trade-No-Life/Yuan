import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { handleProxyRequest, toProxyConfig } from './scripts/request-proxy.mjs';
var toAppConfig = function (env) {
  return {
    envProfile: env.SIGNAL_TRADER_ENV_PROFILE || 'paper',
    hostLabel: env.SIGNAL_TRADER_HOST_LABEL || env.SIGNAL_TRADER_HOST_ORIGIN || 'local host',
    hostOrigin: env.SIGNAL_TRADER_HOST_ORIGIN || 'http://127.0.0.1:8888',
    enableMutation: env.SIGNAL_TRADER_ENABLE_MUTATION === '1',
    defaultRuntimeId: env.SIGNAL_TRADER_DEFAULT_RUNTIME_ID || '',
  };
};
var runtimeConfigPlugin = function (env) {
  return {
    name: 'signal-trader-runtime-config',
    configureServer: function (server) {
      server.middlewares.use('/app-config.json', function (_req, res) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(toAppConfig(env)));
      });
      server.middlewares.use('/request', function (req, res, next) {
        handleProxyRequest(req, res, toProxyConfig(env)).catch(next);
      });
    },
  };
};
export default defineConfig(function (_a) {
  var mode = _a.mode;
  var env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), runtimeConfigPlugin(env)],
    server: {
      host: '127.0.0.1',
      port: Number(env.PORT || 4173),
    },
  };
});
