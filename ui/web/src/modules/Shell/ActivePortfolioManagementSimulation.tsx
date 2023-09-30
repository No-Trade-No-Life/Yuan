export default {};
// import { Button, Progress, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
// import { ActivePortfolioManagementScene, IShellConf } from '@yuants/kernel';
// import { format, formatDuration, intervalToDuration } from 'date-fns';
// import { parse } from 'jsonc-parser';
// import { useObservable, useObservableState } from 'observable-hooks';
// import React, { useEffect, useState } from 'react';
// import { EMPTY, defer, filter, map, mergeMap, pipe, retry, switchMap, tap } from 'rxjs';
// import { terminal$ } from '../Terminals';
// import { accountFrameSeries$, accountPerformance$ } from '../AccountInfo/model';
// import { fs } from '../FileSystem/api';
// import { currentKernel$ } from '../Kernel/model';
// import { runShellAction$, shellConf$ } from './ShellConfForm';
// import { IBatchShellResultItem, IEnumerableJsonSchema, fromJsonSchema } from './utils';

// export const ActivePortfolioManagementSimulation = React.memo((props: { node?: TabNode }) => {
//   const filename = props.node?.getConfig()?.filename ?? '';
//   const [results, setResults] = useState([] as Array<IBatchShellResultItem>);
//   const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0, endTime: 0 });
//   const [portfolioResult, setPortfolioResult] = useState(
//     {} as Record<
//       string,
//       {
//         daily_alpha: number;
//         daily_beta: number;
//         daily_omega: number;
//         daily_IR: number;
//         daily_IC: number;
//         weekly_alpha: number;
//         weekly_beta: number;
//         weekly_omega: number;
//         weekly_IR: number;
//         weekly_IC: number;
//       }
//     >
//   );

//   const [hpaResult, setHpaResult] = useState({} as Record<string, number>);

//   const terminal = useObservableState(terminal$);

//   useEffect(() => {
//     if (filename) {
//       props.node?.getModel().doAction(Actions.renameTab(props.node.getId(), `批量回测 ${filename}`));
//     }
//   }, [filename]);

//   const tasks = useObservableState(
//     useObservable(
//       pipe(
//         map((x) => x[0]),
//         filter((x) => !!x),
//         switchMap((filename) =>
//           defer(() => fs.readFile(filename)).pipe(
//             retry({ delay: 1000 }),
//             map(
//               (txt) =>
//                 parse(txt, undefined, {
//                   allowTrailingComma: true
//                 }) as IEnumerableJsonSchema<IShellConf>
//             ),
//             mergeMap((schema) => fromJsonSchema<IShellConf>(schema))
//           )
//         )
//       ),
//       [filename]
//     ),
//     []
//   );

//   return (
//     <Space vertical align="start" style={{ width: '100%' }}>
//       <Typography.Text>批量回测配置: {filename}</Typography.Text>
//       <Typography.Text>共 {tasks.length} 个任务</Typography.Text>
//       <Button
//         onClick={() => {
//           if (terminal === undefined) {
//             return;
//           }
//           const scene = ActivePortfolioManagementScene(
//             tasks[0].currency ?? 'YYY',
//             terminal,
//             tasks,
//             { readFile: fs.readFile },
//             tasks[0].leverage
//           );

//           scene.runScene();

//           scene.batchResult$
//             .pipe(
//               //
//               tap({
//                 subscribe: () => {
//                   Toast.info('开始批量回测');
//                   setResults([]);
//                   setProgress({
//                     current: 0,
//                     total: tasks.length,
//                     startTime: Date.now(),
//                     endTime: Date.now()
//                   });
//                 }
//               }),
//               mergeMap((result, i) => {
//                 if (result) {
//                   setResults((results) => results.concat(result));
//                   console.info(formatTime(Date.now()), result.performance);
//                 }
//                 console.info(formatTime(Date.now()), `批量回测子任务结束: ${i + 1}/${tasks.length}`);
//                 setProgress((x) => ({
//                   ...x,
//                   current: x.current + 1,
//                   endTime: Math.max(x.endTime, Date.now())
//                 }));
//                 return EMPTY;
//               }),
//               tap({
//                 finalize: () => {
//                   Toast.success(`批量回放结束`);
//                 }
//               })
//             )
//             .subscribe();

//           scene.activePortfolioManagementResult$
//             .pipe(
//               //
//               tap((scene) => {
//                 // FIXME: 在解决好多品种 OrderMatching 的问题之前，暂时使用 benchmark 的结果
//                 // accountPerformance$.next(scene.activePortfolioAccountPerformanceUnit.performance);
//                 // accountFrameSeries$.next(scene.activePortfolioAccountFrameUnit.data);
//                 accountPerformance$.next(scene.benchmarkAccountPerformanceUnit.performance);
//                 accountFrameSeries$.next(scene.benchmarkAccountFrameUnit.data);
//                 currentKernel$.next(scene.kernel);
//                 setPortfolioResult(
//                   Object.fromEntries(
//                     Object.entries(scene.mapAccountIdToActivePortfolioParamUnit).map(([k, v]) => [
//                       k,
//                       v.active_portfolio_parameters
//                     ])
//                   )
//                 );
//                 const latestStatistics =
//                   scene.activePortfolioOptimizeManagementUnit.statistics[
//                     scene.activePortfolioOptimizeManagementUnit.statistics.length - 1
//                   ];
//                 setHpaResult(latestStatistics.coefficients);
//               })
//             )
//             .subscribe();
//         }}
//       >
//         启动投资组合模拟
//       </Button>
//       <Space>
//         <Progress
//           type="circle"
//           percent={progress.total ? Math.round((progress.current / progress.total) * 100) : 0}
//           showInfo
//         />
//         <Typography.Text>
//           进度: {progress.current} / {progress.total}，已进行时间{' '}
//           {formatDuration(intervalToDuration({ start: progress.startTime, end: progress.endTime }), {})}，ETA:{' '}
//           {format(
//             progress.startTime +
//               ((progress.endTime - progress.startTime) / progress.current) * progress.total || 0,
//             'yyyy-MM-dd HH:mm:ss'
//           )}
//         </Typography.Text>
//       </Space>
//       <Table
//         dataSource={results}
//         rowKey={(e) => e?.accountInfo.account_id ?? ''}
//         columns={[
//           //
//           {
//             title: '净值曲线缩略图',
//             width: 200,
//             fixed: true,
//             render: (_, x) => <img src={x.equityImageSrc}></img>
//           },
//           {
//             title: '配置',
//             width: 250,
//             fixed: true,
//             render: (_, x) => (
//               <Typography.Text copyable ellipsis>
//                 {JSON.stringify(x.shellConf)}
//               </Typography.Text>
//             )
//           },
//           {
//             title: '回溯历史',
//             width: 100,
//             dataIndex: 'duration_of_trades_in_day',
//             sorter: (a, b) => (a?.performance.total_days || 0) - (b?.performance.total_days || 0),
//             render: (_, x) => x.performance.total_days.toFixed(1) + '天'
//           },
//           {
//             title: '周收益率',
//             width: 100,
//             dataIndex: 'weekly_return_ratio',
//             sorter: (a, b) =>
//               (a?.performance.weekly_return_ratio ?? 0) - (b?.performance.weekly_return_ratio ?? 0),
//             render: (_, x) => `${(x.performance.weekly_return_ratio * 100).toFixed(2)}%`
//           },

//           {
//             title: '最大维持保证金',
//             width: 100,
//             dataIndex: 'max_margin',
//             sorter: (a, b) =>
//               (a?.performance.max_maintenance_margin || 0) - (b?.performance.max_maintenance_margin || 0),
//             render: (_, x) => x.performance.max_maintenance_margin.toFixed(2)
//           },

//           {
//             title: '收益回撤比',
//             width: 100,
//             dataIndex: 'net_profit_max_drawdown_profit_ratio',
//             sorter: (a, b) =>
//               (a?.performance.profit_drawdown_ratio || 0) - (b?.performance.profit_drawdown_ratio || 0),
//             render: (_, x) => x.performance.profit_drawdown_ratio.toFixed(5)
//           },
//           {
//             title: '资本回报期',
//             width: 100,
//             dataIndex: 'pp',
//             sorter: (a, b) =>
//               (a?.performance.payback_period_in_days || 0) - (b?.performance.payback_period_in_days || 0),
//             render: (_, x) => `${x.performance.payback_period_in_days.toFixed(1)}天`
//           },
//           {
//             title: '周夏普比率',
//             width: 100,
//             dataIndex: 'weekly_sharpe_ratio',
//             sorter: (a, b) =>
//               (a?.performance.weekly_sharpe_ratio || 0) - (b?.performance.weekly_sharpe_ratio || 0),
//             render: (_, x) =>
//               x.performance.weekly_sharpe_ratio.toLocaleString(undefined, {
//                 style: 'percent',
//                 minimumFractionDigits: 2
//               })
//           },
//           {
//             title: '资金占用率',
//             width: 100,
//             dataIndex: 'capital_occupancy_rate',
//             sorter: (a, b) =>
//               (a?.performance.capital_occupancy_rate || 0) - (b?.performance.capital_occupancy_rate || 0),
//             render: (_, x) =>
//               x.performance.capital_occupancy_rate.toLocaleString(undefined, {
//                 style: 'percent',
//                 minimumFractionDigits: 2
//               })
//           },
//           {
//             title: '投资组合头寸系数',
//             width: 100,
//             render: (_, x) => (hpaResult[x.performance.account_id] || NaN).toFixed(5)
//           },
//           {
//             title: 'daily_alpha',
//             dataIndex: 'daily_alpha',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.daily_alpha || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].daily_alpha || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.daily_alpha || NaN).toFixed(5)
//           },
//           {
//             title: 'daily_beta',
//             dataIndex: 'daily_beta',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.daily_beta || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].daily_beta || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.daily_beta || NaN).toFixed(5)
//           },
//           {
//             title: 'daily_omega',
//             dataIndex: 'daily_omega',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.daily_omega || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].daily_omega || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.daily_omega || NaN).toFixed(5)
//           },
//           {
//             title: 'daily_IR',
//             dataIndex: 'daily_IR',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.daily_IR || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].daily_IR || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.daily_IR || NaN).toFixed(5)
//           },
//           {
//             title: 'daily_IC',
//             dataIndex: 'daily_IC',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.daily_IC || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].daily_IC || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.daily_IC || NaN).toFixed(5)
//           },
//           {
//             title: 'weekly_alpha',
//             dataIndex: 'weekly_alpha',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.weekly_alpha || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].weekly_alpha || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.weekly_alpha || NaN).toFixed(5)
//           },
//           {
//             title: 'weekly_beta',
//             dataIndex: 'weekly_beta',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.weekly_beta || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].weekly_beta || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.weekly_beta || NaN).toFixed(5)
//           },
//           {
//             title: 'weekly_omega',
//             dataIndex: 'weekly_omega',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.weekly_omega || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].weekly_omega || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.weekly_omega || NaN).toFixed(5)
//           },
//           {
//             title: 'weekly_IR',
//             dataIndex: 'weekly_IR',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.weekly_IR || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].weekly_IR || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.weekly_IR || NaN).toFixed(5)
//           },
//           {
//             title: 'weekly_IC',
//             dataIndex: 'weekly_IC',
//             width: 100,
//             sorter: (a, b) =>
//               (portfolioResult[a?.performance.account_id ?? '']?.weekly_IC || 0) -
//               (portfolioResult[b?.performance.account_id ?? ''].weekly_IC || 0),
//             render: (_, x) => (portfolioResult[x.performance.account_id]?.weekly_IC || NaN).toFixed(5)
//           },
//           // TODO: 一系列的性能指标
//           {
//             title: '操作',
//             render: (_, x) => (
//               <Space>
//                 <Button
//                   onClick={() => {
//                     shellConf$.next(x.shellConf);
//                     runShellAction$.next();
//                   }}
//                 >
//                   详情
//                 </Button>
//               </Space>
//             )
//           }
//         ]}
//       ></Table>
//     </Space>
//   );
// });
