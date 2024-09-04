import * as rollup from '@rollup/browser';
import * as path from 'path-browserify';
import * as ts from 'typescript';
import { fs } from './api';
import { resolve } from './resolve';

/**
 * Bundle code from entry
 * @param entry entry filename
 * @returns IIFE-formatted code
 * @public
 */
export const bundleCode = async (entry: string, externals: string[]) => {
  const bundle = await rollup.rollup({
    input: [entry],
    onLog: (level, log, handler) => {
      if (log.code === 'CIRCULAR_DEPENDENCY') {
        return; // Ignore circular dependency warnings
      }
      if (log.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
        return; // Ignore missing IIFE name
      }
      handler(level, log);
    },
    external: externals,
    plugins: [
      {
        name: 'rollup-plugin-yuan',
        async resolveId(source, importer = '/', options) {
          return resolve(source, {
            paths: ['/'],
            extensions: ['.js', '.ts', '.tsx'],
            basedir: path.dirname(importer),
          });
        },
        async load(id) {
          const content = await fs.readFile(path.resolve('/', id));
          if (id.endsWith('.ts')) {
            const transpiled = ts.transpile(content, {
              target: ts.ScriptTarget.ESNext,
            });
            return transpiled;
          }
          if (id.endsWith('.tsx')) {
            const transpiled = ts.transpile(content, {
              target: ts.ScriptTarget.ESNext,
              jsx: ts.JsxEmit.React,
            });
            return transpiled;
          }

          return content;
        },
      },
    ],
  });
  const output = await bundle.generate({ format: 'iife', globals: (name) => `globals["${name}"]` });
  let agentCode = output.output[0].code;
  return agentCode;
};

Object.assign(globalThis, { bundleCode });
