import { BasicUnit, IAccountPerformance, IShellConf, ShellScene } from '@yuants/kernel';
import { IAccountInfo } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { Observable, firstValueFrom, from, map, toArray } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { fs } from '../FileSystem/api';

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

export const exampleSchema = {
  type: 'object',
  properties: {
    script_path: {
      type: 'string',
      const: '/DOTA/5.js',
    },
    shell_config: {
      type: 'object',
      properties: {
        // 配置账户的结算货币 (不指定则需要设法推断品种的基准货币，或者使用全币种账户)
        // 推荐用 const 统一本次批量回测中的货币，在回测中拉取对应的汇率来计算收益，这依赖于行情标准化。
        // 也可以使用一个特殊的 currency: Y 作为基准货币，自动与其他货币保持 1:1 的汇率
        currency: {
          type: 'string',
          const: 'USD',
        },
      },
    },
    script_config: {
      type: 'object',
      properties: {
        数据源: {
          type: 'string',
          const: 'TMGM.TradeMax-Live8/8119858',
        },
        品种: {
          type: 'string',
          enum: ['XAUUSD', 'EURUSD', 'USDJPY', 'GBPUSD'], // 建议从标准品种中生成，支持手动增删改
        },
        周期: {
          type: 'number',
          enum: [300, 900, 1800, 3600],
        },
        // 底仓: {
        //   type: 'number',
        //   const: 0.01
        // },
        // 某个参数是 [50, 100], 必须是 10 的倍数
        // 最小止盈价差: {
        //   type: 'number',
        //   minimum: 0,
        //   maximum: 1,
        //   multipleOf: 0.2
        // }
      },
    },
  },
};

export interface IBatchShellResultItem {
  shellConf: IShellConf;
  performance: IAccountPerformance;
  accountInfo: IAccountInfo;
  equityImageSrc: string;
}

export const runBatchBackTestWorkItem = async (shellConf: IShellConf): Promise<IBatchShellResultItem> => {
  const terminal = await firstValueFrom(terminal$);
  const scene = await ShellScene(terminal, { ...shellConf, disable_log: true }, { readFile: fs.readFile });

  const kernel = scene.kernel;

  const accountInfos: IAccountInfo[] = [];
  new BasicUnit(kernel).onEvent = () => {
    accountInfos.push(scene.accountInfoUnit.accountInfo);
  };

  await kernel.start();

  // Generate SVG (200 x 100 px)
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

  const svg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
  <g>
    <path d="M 0 0 H 200 V 100 H 0 Z" />

    <path d="M 0 ${mapY(0)} H 200" stroke="red" />
  </g>
  <g>
    <path
      d="M 0 ${mapY(0)} ${accountInfos
    .map((info) => `L ${mapX(info.timestamp_in_us)} ${mapY(info.money.equity)}`)
    .join(' ')}"
      stroke="green"
      fill="none"
    />
  </g>
</svg>`;
  const equityImageSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

  return {
    shellConf,
    performance: scene.accountPerformanceUnit.performance,
    accountInfo: scene.accountInfoUnit.accountInfo,
    equityImageSrc,
  };
};
