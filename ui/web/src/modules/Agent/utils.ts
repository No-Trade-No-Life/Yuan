import * as rollup from '@rollup/browser';
import { AgentScene, IAgentConf } from '@yuants/agent';
import { BasicUnit, IAccountPerformance } from '@yuants/kernel';
import { IAccountInfo, IDeploySpec } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import * as path from 'path-browserify';
import {
  Observable,
  Subject,
  firstValueFrom,
  from,
  groupBy,
  lastValueFrom,
  map,
  mergeMap,
  of,
  toArray,
} from 'rxjs';
import * as ts from 'typescript';
import { fs } from '../FileSystem/api';
import { LocalAgentScene } from '../StaticFileServerStorage/LocalAgentScene';
import { terminal$ } from '../Terminals/create-connection'; // ISSUE: WebWorker import this (Expected ":" but found "body")
import { currentHostConfig$ } from '../Workbench/model';

export const rollupLoadEvent$ = new Subject<{ id: string; content: string }>();

/**
 * 从入口开始打包一个 Agent 代码
 * @param entry 入口路径
 * @returns IIFE 格式的代码
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
              // 相对路径
              yield path.join(importer, '..', source);
              yield path.join(importer, '..', source + '.js');
              yield path.join(importer, '..', source + '.ts');
              yield path.join(importer, '..', source, 'index.ts');
              yield path.join(importer, '..', source, 'index.js');
            } else {
              // 绝对路径
              yield path.join('/', source);
              yield path.join('/', source + '.js');
              yield path.join('/', source + '.ts');
              yield path.join('/', source, 'index.ts');
              yield path.join('/', source, 'index.js');
            }
          }
          console.debug(`于 ${importer} 解析路径 ${source} ...`);
          for (const filename of candidate()) {
            try {
              const content = await fs.readFile(filename);
              console.debug(`于 ${importer} 解析路径 ${source} ... 得到 ${filename}`);
              return filename;
            } catch (e) {
              //
            }
          }
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
      publish_account: true,
      bundled_code,
    };
    const manifest: IDeploySpec = {
      package: '@yuants/app-agent',
      env: {
        HV_URL: hv_url,
        STORAGE_TERMINAL_ID: 'MongoDB',
      },
      one_json: theConfig,
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

Object.assign(globalThis, { bundleCode, loadBatchTasks });

export type IEnumerableJsonSchema<T> = JSONSchema7;

// [ ] => [ [] ]
// [ [1] ] => [ [1] ]
// [ [1, 2] ] => [ [1], [2] ]
// [ [1, 2], [3, 4] ] => [ [1, 3], [1, 4], [2, 3], [2, 4] ]
/** 笛卡尔积 */
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

export const runBatchBackTestWorkItem = async (agentConf: IAgentConf): Promise<IBatchAgentResultItem> => {
  if (!agentConf.bundled_code) throw new Error('No bundled_code');
  const scene = currentHostConfig$.value
    ? await AgentScene(await firstValueFrom(terminal$), {
        ...agentConf,
        disable_log: true,
      })
    : await LocalAgentScene({ ...agentConf, disable_log: true });

  const kernel = scene.kernel;

  const accountInfos: IAccountInfo[] = [];
  new BasicUnit(kernel).onEvent = () => {
    accountInfos.push(scene.accountInfoUnit.accountInfo);
  };

  await kernel.start();

  const dataUrl = await generateEquityImage(accountInfos);

  return {
    agentConf: agentConf,
    performance: scene.accountPerformanceUnit.performance,
    accountInfo: scene.accountInfoUnit.accountInfo,
    equityImageSrc: dataUrl,
  };
};

async function generateEquityImage(accountInfos: IAccountInfo[]): Promise<string> {
  const maxY = accountInfos.reduce((acc, cur) => Math.max(acc, cur.money.equity), -Infinity);
  const minY = accountInfos.reduce((acc, cur) => Math.min(acc, cur.money.equity), Infinity);
  const maxX = accountInfos
    .filter((x) => x.timestamp_in_us > 0)
    .reduce((acc, cur) => Math.max(acc, cur.timestamp_in_us), -Infinity);
  const minX = accountInfos
    .filter((x) => x.timestamp_in_us > 0)
    .reduce((acc, cur) => Math.min(acc, cur.timestamp_in_us), Infinity);

  const mapX = (v: number) => Math.round((1 - (maxX - v) / (maxX - minX)) * 200);
  const mapY = (v: number) => Math.round(((maxY - v) / (maxY - minY)) * 100);

  // ISSUE: OffscreenCanvas 会使得 vite build 失败，但是可以忽略
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
  for (const info of accountInfos) {
    ctx.lineTo(mapX(info.timestamp_in_us), mapY(info.money.equity));
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
