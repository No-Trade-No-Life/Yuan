import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import * as fs from 'fs-extra';
import path from 'path';
import { rollup } from 'rollup';

/**
 * Build `dist/extension.bundle.js` if `dist/extension.js` exists
 *
 * @returns
 */
export const buildExtensionBundle = async () => {
  const extensionEntry = path.join(process.cwd(), 'dist/extension.js');
  if (!(await fs.exists(extensionEntry))) {
    return;
  }
  const bundle = await rollup({
    input: [extensionEntry],

    treeshake: true,
    onLog: (level, log, handler) => {
      if (log.code === 'CIRCULAR_DEPENDENCY') {
        return; // Ignore circular dependency warnings
      }
      if (log.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
        return; // Ignore missing IIFE name
      }
      handler(level, log);
    },
    plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), json()],
  });
  const output = await bundle.generate({ format: 'iife' });
  const code = output.output[0].code;
  const bundleFilename = path.join(process.cwd(), 'dist/extension.bundle.js');
  await fs.ensureFile(bundleFilename);
  await fs.writeFile(bundleFilename, code);
};
