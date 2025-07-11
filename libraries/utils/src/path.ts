/**
 * convert params to path.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const encodePath = (...params: any[]): string =>
  params.map((param) => `${param}`.replace(/\//g, '\\/')).join('/');

/**
 * convert path to params.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const decodePath = (path: string): string[] =>
  path.split(/(?<!\\)\//g).map((x) => x.replace(/\\\//g, '/'));
