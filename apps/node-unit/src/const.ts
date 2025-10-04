import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

export const WORKSPACE_DIR = join(tmpdir(), 'yuants', 'node-unit');
export const INSTALL_DIR = join(WORKSPACE_DIR, 'install');

export const getAbsolutePath = (command: string) =>
  execSync(`which ${command} || echo ""`, { encoding: 'utf-8' }).trim();

export const NPM_PATH = getAbsolutePath('npm');
export const PNPM_PATH = getAbsolutePath('pnpm');
export const NODE_PATH = getAbsolutePath('node');
