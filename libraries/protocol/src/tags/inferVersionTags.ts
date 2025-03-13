import { isNode } from 'browser-or-node';

/**
 * Infer the
 * @param terminal
 * @returns
 */
export const inferNodePackageTags = (): Record<string, string> => {
  //
  if (!isNode) return {};

  const stack = new Error().stack;
  if (!stack) return {};
  const terminalCallPlace = stack.split('\n')?.[3].match(/\(([^:]+)/)?.[1];
  if (!terminalCallPlace) return {};
  const outerPackageJson = nodeJSGetPackageJsonFromFilename(terminalCallPlace);
  const protocolPackageJson = nodeJSGetPackageJsonFromFilename(__filename);

  return {
    protocol_version: protocolPackageJson?.version || '',
    terminal_package: outerPackageJson?.name || '',
    terminal_version: outerPackageJson?.version || '',
  };
};

const nodeJSGetPackageJsonFromFilename = (
  filename: string,
): { name: string; version: string; [key: string]: any } | null => {
  const fs = require('fs');
  const path = require('path');
  let ptr = filename;
  while (true) {
    if (ptr === '/') break;

    const pkgPath = path.join(ptr, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath);
      return pkg;
    }

    ptr = path.dirname(ptr);
  }
  return null;
};
