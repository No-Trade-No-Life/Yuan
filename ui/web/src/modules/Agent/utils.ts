import * as rollup from '@rollup/browser';
import { AgentScene, IAgentConf } from '@yuants/agent';
import { IAccountInfo } from '@yuants/data-account';
import { IDeploySpec } from '@yuants/extension';
import { BasicFileSystemUnit, BasicUnit, IAccountPerformance } from '@yuants/kernel';
import { UUID } from '@yuants/utils';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import * as path from 'path-browserify';
import {
  filter,
  firstValueFrom,
  from,
  groupBy,
  lastValueFrom,
  map,
  mergeMap,
  Observable,
  of,
  Subject,
  toArray,
} from 'rxjs';
import * as ts from 'typescript';
import { fs } from '../FileSystem/api';
import { terminal$ } from '../Network';

export const rollupLoadEvent$ = new Subject<{ id: string; content: string }>();

/**
 * Bundle code from entry
 * @param entry entry filename
 * @returns IIFE-formatted code
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
              yield path.join(importer, '..', source, 'index.ts');
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
          rollupLoadEvent$.next({ id, content });
          if (id.endsWith('.ts')) {
            const transpiled = ts.transpile(content, { target: ts.ScriptTarget.ESNext });
            return transpiled;
          }
          return content;
        },
      },
    ],
  });
  const output = await bundle.generate({ format: 'iife' });
  let agentCode = output.output[0].code;
  return agentCode;
};

/**
 * Bundle code from entry
 * @param entry entry filename
 * @returns IIFE-formatted code
 */
export const bundleCodeFromInMemoryCode = async (entry_code: string) => {
  const mainId = '/' + UUID();
  const bundle = await rollup.rollup({
    input: [mainId],
    onLog: (level, log, handler) => {
      if (log.code === 'CIRCULAR_DEPENDENCY') {
        return; // Ignore circular dependency warnings
      }
      if (log.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
        return; // Ignore missing IIFE name
      }
      handler(level, log);
    },
    plugins: [
      {
        name: 'rollup-plugin-yuan',
        async resolveId(source, importer = '/', options) {
          if (source === mainId) {
            return mainId;
          }
          function* candidate() {
            if (source[0] === '.') {
              // relative path
              yield path.join(importer, '..', source);
              yield path.join(importer, '..', source + '.js');
              yield path.join(importer, '..', source + '.ts');
              yield path.join(importer, '..', source, 'index.ts');
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
          if (id === mainId) {
            return entry_code;
          }
          const content = await fs.readFile(id);
          rollupLoadEvent$.next({ id, content });
          if (id.endsWith('.ts')) {
            const transpiled = ts.transpile(content, { target: ts.ScriptTarget.ESNext });
            return transpiled;
          }
          return content;
        },
      },
    ],
  });
  const output = await bundle.generate({ format: 'iife' });
  let agentCode = output.output[0].code;
  return agentCode;
};

export const importModule = async (entry: string) => {
  const code = await bundleCode(entry);
  const module = new Function(`return ${code}`).call(undefined);
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

export const loadBatchTasks = async (entry: string) => {
  const module: () => AsyncIterable<IAgentConf> = await importModule(entry);
  return await lastValueFrom(
    from(module()).pipe(
      // ensure bundled_code
      mergeMap((conf) => {
        if (!conf.entry) {
          throw new Error(`AgentConf must have entry or bundled_code`);
        }
        return of(conf);
      }),
      groupBy((conf) => conf.entry!),
      mergeMap((group) =>
        group.pipe(
          toArray(),
          mergeMap((agentConfList) =>
            from(bundleCode(group.key)).pipe(
              mergeMap((bundled_code) =>
                from(agentConfList).pipe(
                  //
                  map((agentConf): IAgentConf => ({ ...agentConf, bundled_code })),
                ),
              ),
            ),
          ),
        ),
      ),
      toArray(),
    ),
  );
};

export const makeManifestsFromAgentConfList = async (
  agentConfList: IAgentConf[],
  hv_url: string,
): Promise<IDeploySpec[]> => {
  const ret: IDeploySpec[] = [];
  for (const agentConf of agentConfList) {
    const bundled_code = await agentConf.bundled_code;

    const theConfig: IAgentConf = {
      ...agentConf,
      is_real: true,
      bundled_code,
    };
    const manifest: IDeploySpec = {
      key: agentConf.kernel_id!,
      package: '@yuants/app-agent',
      env: {
        HV_URL: hv_url,
      },
      one_json: JSON.stringify(theConfig),
    };
    ret.push(manifest);
  }
  return ret;
};

export const writeManifestsFromBatchTasks = async (entry: string, hv_url: string) => {
  const tasks = await loadBatchTasks(entry);
  const manifests = await makeManifestsFromAgentConfList(tasks, hv_url);
  await fs.writeFile(`${entry}.manifests.json`, JSON.stringify(manifests, null, 2));
};

Object.assign(globalThis, { loadBatchTasks });

export type IEnumerableJsonSchema<T> = JSONSchema7;

// [ ] => [ [] ]
// [ [1] ] => [ [1] ]
// [ [1, 2] ] => [ [1], [2] ]
// [ [1, 2], [3, 4] ] => [ [1, 3], [1, 4], [2, 3], [2, 4] ]
/** cartesian product */
export const cartesianProduct = <T>([head, ...tail]: T[][]): T[][] =>
  head?.flatMap((xx) => cartesianProduct(tail).map((xxx) => [xx, ...xxx])) ?? [[]];

interface IAssignOperation {
  path: string[];
  value: any;
}

export const extractVectors = <T>(
  schema: IEnumerableJsonSchema<T>,
  ret: IAssignOperation[][] = [],
  path: string[] = [],
) => {
  if (schema.type === 'object') {
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (typeof child !== 'object') {
        throw '';
      }
      extractVectors(child, ret, [...path, key]);
    }
  }
  if (schema.const) {
    ret.push([{ path, value: schema.const }]);
  }
  if (schema.enum) {
    ret.push(schema.enum.map((value) => ({ path, value })));
  }
  if (
    (schema.type === 'number' || schema.type === 'integer') &&
    schema.minimum !== undefined &&
    schema.maximum !== undefined
  ) {
    // Range
    const arr: IAssignOperation[] = [];
    const multipleOf = schema.multipleOf || 1;
    for (let i = schema.minimum; i <= schema.maximum; i += multipleOf) {
      const v = Math.ceil(i / multipleOf) * multipleOf;
      if (v <= schema.maximum) {
        arr.push({ path, value: v });
      }
    }
    ret.push(arr);
  }
  return ret;
};

export const fromJsonSchema = <T>(schema: IEnumerableJsonSchema<T>): Observable<T[]> => {
  return from(cartesianProduct(extractVectors(schema))).pipe(
    map(
      (x) =>
        x.reduce((obj, conf) => {
          if (conf.path.length === 0) {
            return conf.value;
          }
          let ptr = obj;
          for (let key of conf.path.slice(0, -1)) {
            ptr = ptr[key] ??= {};
          }
          ptr[conf.path[conf.path.length - 1]] = conf.value;
          return obj;
        }, {} as any) as T,
    ),
    toArray(),
  );
};

export interface IBatchAgentResultItem {
  agentConf: IAgentConf;
  performance: IAccountPerformance;
  accountInfo: IAccountInfo;
  equityImageSrc: string;
}

export const runBatchBackTestWorkItem = async (agentConf: IAgentConf): Promise<IBatchAgentResultItem[]> => {
  if (!agentConf.bundled_code) throw new Error('No bundled_code');
  const terminal = await firstValueFrom(
    terminal$.pipe(filter((x): x is Exclude<typeof x, null> => x !== null)),
  );
  const scene = await AgentScene(terminal, {
    ...agentConf,
    disable_log: true,
  });

  const kernel = scene.kernel;

  const fsUnit = new BasicFileSystemUnit(kernel);
  fsUnit.readFile = async (filename: string) => {
    await fs.ensureDir(path.dirname(filename));
    const content = await fs.readFile(filename);
    return content;
  };
  fsUnit.writeFile = async (filename: string, content: string) => {
    await fs.ensureDir(path.dirname(filename));
    await fs.writeFile(filename, content);
  };

  // const accountInfoLists: Record<string, IAccountInfo[]> = {};
  const mapAccountIdToEquityPoints: Record<string, { x: number; y: number }[]> = {};
  new BasicUnit(kernel).onEvent = () => {
    for (const [accountId, accountInfo] of scene.accountInfoUnit.mapAccountIdToAccountInfo.entries()) {
      (mapAccountIdToEquityPoints[accountId] ??= []).push({
        x: kernel.currentTimestamp,
        y: accountInfo.money.equity,
      });
    }
  };

  await kernel.start();

  const results: IBatchAgentResultItem[] = [];

  for (const [accountId, points] of Object.entries(mapAccountIdToEquityPoints)) {
    const dataUrl = await generateEquityImage(points);
    results.push({
      agentConf: agentConf,
      performance: scene.accountPerformanceUnit.mapAccountIdToPerformance.get(accountId)!,
      accountInfo: scene.accountInfoUnit.mapAccountIdToAccountInfo.get(accountId)!,
      equityImageSrc: dataUrl,
    });
  }

  return results;
};

async function generateEquityImage(data: { x: number; y: number }[]): Promise<string> {
  const maxY = data.reduce((acc, cur) => Math.max(acc, cur.y), -Infinity);
  const minY = data.reduce((acc, cur) => Math.min(acc, cur.y), Infinity);
  const maxX = data.filter((x) => x.x! > 0).reduce((acc, cur) => Math.max(acc, cur.x!), -Infinity);
  const minX = data.filter((x) => x.x! > 0).reduce((acc, cur) => Math.min(acc, cur.x!), Infinity);

  const mapX = (v: number) => Math.round((1 - (maxX - v) / (maxX - minX)) * 200);
  const mapY = (v: number) => Math.round(((maxY - v) / (maxY - minY)) * 100);

  // ISSUE: OffscreenCanvas cause vite build failed, but it works in browser, so we use @ts-ignore
  // @ts-ignore
  const canvas = new OffscreenCanvas(200, 100);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error(`Failed to get 2d context when drawing equity chart`);

  ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.moveTo(0, mapY(0));
  ctx.lineTo(200, mapY(0));
  ctx.stroke();

  ctx.strokeStyle = 'green';
  ctx.beginPath();
  ctx.moveTo(0, mapY(0));
  for (const info of data) {
    ctx.lineTo(mapX(info.x!), mapY(info.y));
  }
  ctx.stroke();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
  const dataUrl = await blobToDataURL(blob);
  return dataUrl;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (_e) => resolve(reader.result as string);
    reader.onerror = (_e) => reject(reader.error);
    reader.onabort = (_e) => reject(new Error('Read aborted'));
    reader.readAsDataURL(blob);
  });
}
