import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as child from 'child_process';

const commitHash = child.execSync('git rev-parse --short HEAD').toString();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILT_AT__: Date.now(),
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
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        // if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
      },
    },
  },
});
