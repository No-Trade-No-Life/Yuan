import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as child from 'child_process';

const commitHash = child.execSync('git rev-parse --short HEAD').toString();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react()],
  optimizeDeps: {
    // 👈 optimizedeps
    esbuildOptions: {
      target: 'esnext',
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
      supported: {
        bigint: true,
      },
    },
  },
  build: {
    target: ['esnext'], // 👈 build.target
    chunkSizeWarningLimit: 1e6, // 暂时按住 warning，节约 build 时间
  },
});
