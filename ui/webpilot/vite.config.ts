import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    // 多入口配置 - Chrome 扩展需要多个入口点
    rollupOptions: {
      input: {
        // 后台脚本入口
        background: resolve(__dirname, 'src/background/background.ts'),
        // 内容脚本入口
        content: resolve(__dirname, 'src/content/content.ts'),
        // 弹窗入口
        popup: resolve(__dirname, 'src/popup/popup.tsx'),
        // userScript 入口 - 用于运行需要 unsafe-eval 的代码
        'unsafe-eval-script': resolve(__dirname, 'src/user-scripts/unsafe-eval-script.ts'),
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
