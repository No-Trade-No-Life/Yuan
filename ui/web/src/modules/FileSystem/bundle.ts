import * as rollup from '@rollup/browser';
import { t } from 'i18next';
import * as path from 'path-browserify';
import * as ts from 'typescript';
import { fs } from './api';

/**
 * Bundle code from entry
 * @param entry entry filename
 * @returns IIFE-formatted code
 * @public
 */
export const bundleCode = async (entry: string) => {
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
    external: (id) => id[0] !== '.' && id[0] !== '/',
    plugins: [
      {
        name: 'rollup-plugin-yuan',
        async resolveId(source, importer = '/', options) {
          function* candidate() {
            if (source[0] === '.') {
              // relative path
              yield path.join(importer, '..', source);
              yield path.join(importer, '..', source + '.js');
              yield path.join(importer, '..', source + '.ts');
              yield path.join(importer, '..', source + '.tsx');
              yield path.join(importer, '..', source, 'index.ts');
              yield path.join(importer, '..', source, 'index.tsx');
              yield path.join(importer, '..', source, 'index.js');
            } else {
              // absolute path
              yield path.join('/', source);
              yield path.join('/', source + '.js');
              yield path.join('/', source + '.ts');
              yield path.join('/', source, 'index.ts');
              yield path.join('/', source, 'index.js');
            }
          }
          for (const filename of candidate()) {
            try {
              await fs.readFile(filename);
              return filename;
            } catch (e) {
              //
            }
          }
          throw new Error(
            t('common:reference_error', { importer, source, interpolation: { escapeValue: false } }),
          );
        },
        async load(id) {
          const content = await fs.readFile(id);
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
