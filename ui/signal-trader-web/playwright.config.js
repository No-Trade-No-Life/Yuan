var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
import { defineConfig } from '@playwright/test';
var port = Number(process.env.PORT || 4173);
export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:'.concat(port),
    headless: true,
  },
  webServer: {
    command: 'node scripts/serve-with-proxy.mjs',
    url: 'http://127.0.0.1:'.concat(port, '/healthz'),
    reuseExistingServer: false,
    timeout: 120000,
    env: __assign(__assign({}, process.env), { PORT: String(port) }),
  },
});
