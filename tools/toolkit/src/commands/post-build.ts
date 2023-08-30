import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { Command } from 'clipanion';
import * as fs from 'fs-extra';
import path from 'path';
import { rollup } from 'rollup';

export class PostBuildCommand extends Command {
  static paths = [['post-build']];

  async execute(): Promise<number | void> {
    // build extension.bundle.js
    if (await fs.exists(path.join(process.cwd(), 'dist/extension.js'))) {
      const code = await build('dist/extension.js');
      const bundleFilename = path.join(process.cwd(), 'dist/extension.bundle.js');
      await fs.ensureFile(bundleFilename);
      await fs.writeFile(bundleFilename, code);
    }

    return 0;
  }
}

const build = async (entry: string) => {
  const bundle = await rollup({
    input: [entry],
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
  let agentCode = output.output[0].code;
  return agentCode;
};
