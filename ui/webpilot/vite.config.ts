import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'fs/promises': resolve(__dirname, 'src/shims/fs-promises.ts'),
      'node:fs/promises': resolve(__dirname, 'src/shims/fs-promises.ts'),
    },
  },
  build: {
    // 多入口配置 - Chrome 扩展需要多个入口点
    rollupOptions: {
      input: {
        // 后台脚本入口
        background: resolve(__dirname, 'src/background/background.ts'),
        // 弹窗入口
        popup: resolve(__dirname, 'src/popup/popup.tsx'),
      },
      output: {
        // 输出到 dist 目录，保持原有文件名
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // 禁用代码分割，Chrome 扩展需要独立文件
    chunkSizeWarningLimit: 1000,
  },
  // 开发服务器配置
  server: {
    port: 3000,
  },
});
