// import { formatTime } from '@yuants/utils';
// import { IAccountInfo, IOrder, Terminal } from '@yuants/protocol';
// import { Subject, catchError, defer, filter, from, map, mergeMap, of, retry, tap, toArray } from 'rxjs';
// import { Kernel } from '../kernel';
// import {
//   AccountPerformanceUnit,
//   AccountSimulatorUnit,
//   BasicUnit,
//   HistoryOrderUnit,
//   IAccountPerformance,
//   OrderMatchingUnit,
// } from '../units';
// import { AccountFrameUnit } from '../units/AccountFrameUnit';
// import { ActivePortfolioOptimizeSimulatorUnit } from '../units/ActivePortfolioOptimizeSimulatorUnit';
// import { ActivePortfolioParamUnit } from '../units/ActivePortfolioParamUnit';
// import { createEmptyAccountInfo } from '../utils';
// import { OrderMergeReplayScene } from './OrderMergeReplayScene';
// import { IShellConf, ShellScene } from './ShellScene';

// /**
//  * @public
//  */
// export interface IBatchShellResultItem {
//   shellConf: IShellConf;
//   performance: IAccountPerformance;
//   accountInfo: IAccountInfo;
//   equityImageSrc: string;
// }

// /**
//  * @public
//  */
// export interface IActivePortfolioManagementParameters {
//   account_ids: string[];
//   daily_alpha_list: number[];
//   daily_V: number[][];
//   weekly_alpha_list: number[];
//   weekly_V: number[][];
// }

// const multiply_matrix = (a: number[][], b: number[][]): number[][] => {
//   const n = a.length;
//   const m = b[0].length;
//   const p = b.length;
//   const c = Array.from({ length: n }, () => Array.from({ length: m }, () => 0));
//   for (let i = 0; i < n; i++) {
//     for (let j = 0; j < m; j++)
//       for (let k = 0; k < p; k++) {
//         c[i][j] += a[i][k] * b[k][j];
//       }
//   }
//   return c;
// };

// const makeAccountEquityImageSrc = (accountInfos: IAccountInfo[]) => {
//   // Generate SVG (200 x 100 px)
//   const maxY = accountInfos.reduce((acc, cur) => Math.max(acc, cur.money.equity), -Infinity);
//   const minY = accountInfos.reduce((acc, cur) => Math.min(acc, cur.money.equity), Infinity);
//   const maxX = accountInfos
//     .filter((x) => x.timestamp_in_us > 0)
//     .reduce((acc, cur) => Math.max(acc, cur.timestamp_in_us), -Infinity);
//   const minX = accountInfos
//     .filter((x) => x.timestamp_in_us > 0)
//     .reduce((acc, cur) => Math.min(acc, cur.timestamp_in_us), Infinity);

//   const mapX = (v: number) => Math.round((1 - (maxX - v) / (maxX - minX)) * 200);
//   const mapY = (v: number) => Math.round(((maxY - v) / (maxY - minY)) * 100);

//   const svg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
//   <g>
//     <path d="M 0 0 H 200 V 100 H 0 Z" />

//     <path d="M 0 ${mapY(0)} H 200" stroke="red" />
//   </g>
//   <g>
//     <path
//       d="M 0 ${mapY(0)} ${accountInfos
//     .map((info) => `L ${mapX(info.timestamp_in_us)} ${mapY(info.money.equity)}`)
//     .join(' ')}"
//       stroke="green"
//       fill="none"
//     />
//   </g>
// </svg>`;
//   const equityImageSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
//   return equityImageSrc;
// };

// /**
//  * 内建场景：主动投资组合管理场景
//  * @public
//  */
// export const ActivePortfolioManagementScene = (
//   currency: string,
//   terminal: Terminal,
//   shellConfigs: IShellConf[],
//   scriptResolver: { readFile: (path: string) => Promise<string> },
//   leverage?: number,
// ) => {
//   const shellScene$ = from(shellConfigs).pipe(
//     //
//     mergeMap(
//       (shellConf, i) =>
//         defer(async () => {
//           const scene = await ShellScene(terminal, shellConf, scriptResolver);

//           const accountInfos: IAccountInfo[] = [];
//           new BasicUnit(scene.kernel).onEvent = () => {
//             accountInfos.push(scene.accountInfoUnit.accountInfo);
//           };

//           await scene.kernel.start();
//           const equityImageSrc = makeAccountEquityImageSrc(accountInfos);

//           return {
//             scene,
//             equityImageSrc,
//           };
//         }).pipe(
//           tap({
//             subscribe: () => {
//               console.info(formatTime(Date.now()), `批量回测子任务开始: ${i + 1}/${shellConfigs.length}`);
//             },
//             error: (err) => {
//               console.info(
//                 formatTime(Date.now()),
//                 `批量回测子任务异常: ${i + 1}/${shellConfigs.length}: ${err}`,
//               );
//             },
//           }),
//           retry({ delay: 10_000, count: 3 }), // 最多重试3次，防止卡死流程
//           catchError(() => of(undefined)), // 忽略错误，跳过该任务
//           tap((result) => {
//             if (result) {
//               const { scene, equityImageSrc } = result;
//               batchResult$.next({
//                 shellConf,
//                 performance: scene.accountPerformanceUnit.performance,
//                 accountInfo: scene.accountInfoUnit.accountInfo,
//                 equityImageSrc,
//               });
//             } else {
//               batchResult$.next(undefined);
//             }
//           }),
//           filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
//         ),
//       1,
//     ),
//   );

//   const run$ = shellScene$.pipe(
//     map(({ scene }) => scene),
//     toArray(),
//     mergeMap(async (scenes) => {
//       const orders = scenes.flatMap(
//         (scene) =>
//           (scene.portfolioHistoryOrderUnit || scene.stopLossHistoryOrderUnit || scene.historyOrderUnit)
//             .historyOrders,
//       );
//       const products = [
//         ...new Map(
//           scenes
//             .flatMap((scene) => Object.values(scene.productDataUnit.mapProductIdToProduct))
//             .map((product) => [product.product_id, product]),
//         ).values(),
//       ];
//       const periods = [
//         ...new Map(
//           scenes
//             .flatMap((scene) => Object.values(scene.periodDataUnit.data).flat())
//             .map((period) => [
//               [period.product_id, period.period_in_sec, period.timestamp_in_us].join(),
//               period,
//             ]),
//         ).values(),
//       ];

//       const kernel = new Kernel();

//       const benchmarkScene = OrderMergeReplayScene(
//         kernel,
//         createEmptyAccountInfo('BenchmarkAccount', currency, leverage),
//         periods,
//         orders,
//         products,
//       );

//       const benchmarkAccountFrameUnit = new AccountFrameUnit(
//         kernel,
//         benchmarkScene.accountInfoUnit,
//         benchmarkScene.accountPerformanceUnit,
//       );

//       const mapAccountIdToUnits = Object.fromEntries(
//         scenes.map((shellScene) => {
//           const orders = shellScene.historyOrderUnit.historyOrders;

//           const accountInfo = shellScene.accountInfoUnit.accountInfo;

//           const historyOrderUnit = new HistoryOrderUnit(
//             kernel,
//             benchmarkScene.quoteDataUnit,
//             benchmarkScene.productDataUnit,
//           );
//           {
//             const mapEventIdToOrder = new Map<number, IOrder>();
//             for (const order of orders) {
//               const id = kernel.alloc(order.timestamp_in_us! / 1000);
//               mapEventIdToOrder.set(id, order);
//             }
//             new BasicUnit(kernel).onEvent = () => {
//               const order = mapEventIdToOrder.get(kernel.currentEventId);
//               if (order) {
//                 historyOrderUnit.updateOrder(order);
//                 mapEventIdToOrder.delete(kernel.currentEventId);
//               }
//             };
//           }
//           const accountInfoUnit = new AccountSimulatorUnit(
//             kernel,
//             benchmarkScene.productDataUnit,
//             benchmarkScene.quoteDataUnit,
//             historyOrderUnit,
//             createEmptyAccountInfo(
//               accountInfo.account_id,
//               accountInfo.money.currency,
//               accountInfo.money.leverage,
//             ),
//           );
//           const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);

//           const activePortfolioParamUnit = new ActivePortfolioParamUnit(
//             kernel,
//             accountPerformanceUnit,
//             benchmarkScene.accountPerformanceUnit,
//           );
//           return [
//             accountInfo.account_id,
//             {
//               accountInfoUnit,
//               accountPerformanceUnit,
//               activePortfolioParamUnit,
//               historyOrderUnit,
//             },
//           ];
//         }),
//       );

//       const activePortfolioHistoryOrderUnit = new HistoryOrderUnit(
//         kernel,
//         benchmarkScene.quoteDataUnit,
//         benchmarkScene.productDataUnit,
//       );
//       const activePortfolioAccountInfoUnit = new AccountSimulatorUnit(
//         kernel,
//         benchmarkScene.productDataUnit,
//         benchmarkScene.quoteDataUnit,
//         activePortfolioHistoryOrderUnit,
//         createEmptyAccountInfo('ActivePortfolioAccount', currency, leverage),
//       );

//       const activePortfolioAccountPerformanceUnit = new AccountPerformanceUnit(
//         kernel,
//         activePortfolioAccountInfoUnit,
//       );
//       const activePortfolioOrderMatchingUnit = new OrderMatchingUnit(
//         kernel,
//         benchmarkScene.productDataUnit,
//         benchmarkScene.periodDataUnit,
//         activePortfolioHistoryOrderUnit,
//       );

//       const activePortfolioOptimizeManagementUnit = new ActivePortfolioOptimizeSimulatorUnit(
//         kernel,
//         benchmarkScene.periodDataUnit,
//         benchmarkScene.productDataUnit,
//         0.1,
//         mapAccountIdToUnits,
//         activePortfolioAccountInfoUnit,
//         activePortfolioAccountPerformanceUnit,
//         activePortfolioOrderMatchingUnit,
//       );

//       const activePortfolioAccountFrameUnit = new AccountFrameUnit(
//         kernel,
//         activePortfolioAccountInfoUnit,
//         activePortfolioAccountPerformanceUnit,
//       );

//       await benchmarkScene.kernel.start();

//       return {
//         kernel,
//         benchmarkAccountPerformanceUnit: benchmarkScene.accountPerformanceUnit,
//         benchmarkAccountFrameUnit,
//         activePortfolioAccountPerformanceUnit,
//         activePortfolioAccountFrameUnit,
//         activePortfolioOptimizeManagementUnit,
//         mapAccountIdToActivePortfolioParamUnit: Object.fromEntries(
//           Object.entries(mapAccountIdToUnits).map(([accountId, units]) => [
//             accountId,
//             units.activePortfolioParamUnit,
//           ]),
//         ),
//       };
//     }),
//     tap((result) => {
//       activePortfolioManagementResult$.next(result);
//     }),
//   );

//   const batchResult$ = new Subject<IBatchShellResultItem | undefined>();
//   const activePortfolioManagementResult$ = new Subject<{
//     kernel: Kernel;
//     benchmarkAccountPerformanceUnit: AccountPerformanceUnit;
//     benchmarkAccountFrameUnit: AccountFrameUnit;
//     activePortfolioAccountPerformanceUnit: AccountPerformanceUnit;
//     activePortfolioAccountFrameUnit: AccountFrameUnit;
//     activePortfolioOptimizeManagementUnit: ActivePortfolioOptimizeSimulatorUnit;
//     mapAccountIdToActivePortfolioParamUnit: Record<string, ActivePortfolioParamUnit>;
//   }>();

//   return {
//     runScene: () => {
//       run$.subscribe();
//     },
//     batchResult$: batchResult$.asObservable(),
//     activePortfolioManagementResult$: activePortfolioManagementResult$.asObservable(),
//   };
// };
