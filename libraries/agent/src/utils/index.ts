/**
 * 将参数转换为路径，用 `/` 分隔，如果参数中包含 `/` 则转义为 `\/`
 * @param params - 参数
 * @public
 */
export const encodePath = (...params: any[]): string =>
  params.map((param) => `${param}`.replace(/\//g, '\\/')).join('/');

/**
 * 将路径转换为参数，用 `/` 分隔，如果参数中包含 `\/` 则转义为 `/`
 * @param path - 路径
 * @public
 */
export const decodePath = (path: string): string[] =>
  path.split(/(?<!\\)\//g).map((x) => x.replace(/\\\//g, '/'));
