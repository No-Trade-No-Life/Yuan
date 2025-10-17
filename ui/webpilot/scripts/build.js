import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const publicDir = join(projectRoot, 'public');

async function ensureDir(path) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

async function copyFiles() {
  console.log('Copying extension files to dist directory...');

  // 确保 dist 目录存在
  await ensureDir(distDir);

  // 复制 manifest.json
  await copyFile(join(publicDir, 'manifest.json'), join(distDir, 'manifest.json'));

  // 复制图标文件（如果存在）
  const iconsDir = join(publicDir, 'icons');
  const distIconsDir = join(distDir, 'icons');

  if (existsSync(iconsDir)) {
    await ensureDir(distIconsDir);
    // 这里可以添加具体的图标文件复制逻辑
    console.log('Icons directory exists, but specific icon copying not implemented yet');
  }

  console.log('Extension files copied successfully!');
}

copyFiles().catch(console.error);
