import { createCache } from '@yuants/cache';
import { decodePath, encodePath } from '@yuants/utils';
import { mkdir, rm, stat, symlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { lastValueFrom } from 'rxjs';
import { INSTALL_DIR, NPM_PATH, PNPM_PATH } from './const';
import { spawnChild } from './spawnChild';

/**
 * 获取缓存键
 */
const getCacheKey = (packageName: string, packageVersion: string): string => {
  return encodePath(packageName, packageVersion);
};

/**
 * 准备部署工作区的异步函数
 * 对于相同的参数，返回同一个 Promise
 * 只负责准备好部署所需的工作区，不进行链接
 * 在 cacheDir 下创建一个目录，并在里面进行 pnpm install
 * install 完成后才会返回
 */
const prepareWorkspace = createCache<string>(
  async (key) => {
    const [packageName, packageVersion] = decodePath(key);

    const installDir = join(INSTALL_DIR, packageName, packageVersion);

    console.info(
      `[prepareWorkspace] Starting preparation for ${packageName}@${packageVersion} at ${installDir}`,
    );

    // 确保缓存目录为空
    await rm(installDir, { recursive: true, force: true });
    await mkdir(installDir, { recursive: true });

    // 创建 package.json
    await writeFile(
      join(installDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          [packageName]: packageVersion,
        },
      }),
    );

    // 执行 pnpm install
    const installCommand = PNPM_PATH || NPM_PATH;
    const installArgs = ['install', '-C', installDir];

    console.info(`[prepareWorkspace] Running ${installCommand} ${installArgs.join(' ')}`);
    await lastValueFrom(
      spawnChild({
        command: PNPM_PATH || NPM_PATH,
        args: ['install', '-C', installDir],
        env: Object.assign({}, process.env),
      }),
    );
    console.info(`[prepareWorkspace] Installation completed for ${packageName}@${packageVersion}`);
    return installDir;
  },
  {
    //
    readLocal: async (key) => {
      const [packageName, packageVersion] = decodePath(key);
      const installDir = join(INSTALL_DIR, packageName, packageVersion);
      await stat(installDir);
      return installDir;
    },
  },
);

/**
 * 便捷函数，直接使用包名和版本调用
 */
export const prepareWorkspaceByPackage = async (
  packageName: string,
  packageVersion: string,
  force_update = false,
): Promise<string> => {
  const key = getCacheKey(packageName, packageVersion);
  const result = await prepareWorkspace.query(key, force_update);
  if (!result) throw new Error('Unexpected null result from prepareWorkspace');
  return result;
};

export const installWorkspaceTo = async (
  packageName: string,
  packageVersion: string,
  targetDir: string,
  force_update = false,
) => {
  const installed = await prepareWorkspaceByPackage(packageName, packageVersion, force_update);
  const dir = dirname(targetDir);
  await mkdir(dir, { recursive: true });
  // 清零目标软链接 (一般来说是链接文件，但也可能是目录 (旧版))
  await rm(targetDir, { recursive: true, force: true });
  await symlink(installed, targetDir, 'dir');
  return targetDir;
};
