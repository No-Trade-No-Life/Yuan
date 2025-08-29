import { IDeploySpec } from '@yuants/extension';
import { from, lastValueFrom, toArray } from 'rxjs';
import { bundleCode } from '../Agent/utils';

export const loadManifests = async (entry: string) => {
  const module: () => AsyncIterable<IDeploySpec> = await importModule(entry);
  return await lastValueFrom(
    from(module()).pipe(
      //
      toArray(),
    ),
  );
};

export const importModule = async (entry: string) => {
  const code = await bundleCode(entry);
  const module = new Function('DeployContext', `return ${code}`).call(undefined, { bundleCode });
  if (module.__esModule) {
    if (typeof module.default === 'function') {
      return module.default;
    }
    throw new Error(`Module must export default function`);
  }
  if (typeof module !== 'function') {
    throw new Error('Module must export default function');
  }
  return module;
};

/**
 * 将字符串安全转义为 Bash 环境变量值格式
 * 优先使用单引号，如果包含单引号则使用双引号并转义特殊字符
 * @param str 要转义的字符串
 * @returns 转义后的 Bash 安全字符串
 */
export function escapeForBash(str: string): string {
  // 检查是否包含单引号
  if (str.includes("'")) {
    // 如果有单引号，使用双引号并转义内部特殊字符
    return `"${str.replace(/(["$`\\])/g, '\\$1')}"`;
  }

  // 默认使用单引号（最安全，防止任何扩展）
  return `'${str}'`;
}
