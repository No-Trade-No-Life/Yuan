export {};
// import { Space, Toast } from '@douyinfe/semi-ui';
// import { AccountPerformanceUnit } from '@yuants/kernel';
// import { IAccountInfo } from '@yuants/protocol';
// import { IPerformance, IPortfolioStatistics, IShellConf, Shell, portfolioSimulation } from '@yuants/shell';
// import { format } from 'date-fns';
// import { useObservableState } from 'observable-hooks';
// import React, { useState } from 'react';
// import {
//   BehaviorSubject,
//   defer,
//   distinct,
//   filter,
//   first,
//   map,
//   mergeMap,
//   reduce,
//   shareReplay,
//   tap,
//   toArray
// } from 'rxjs';
// import { accountFrameSeries$, accountPerformance$ } from '../AccountInfo/model';
// import Form from '../Form';
// import { orders$ } from '../Order/model';
// export interface IBatchBackTestResult {
//   task: IShellConf;
//   shell: Shell;
//   performance: IPerformance;
//   accountInfos: IAccountInfo[];
// }
// export const batchBacktestResult$ = new BehaviorSubject<IBatchBackTestResult[]>([]);

// export const portfolioStatistics$ = new BehaviorSubject<IPortfolioStatistics[]>([]);

// export const PortfolioStatisticsPanel = React.memo(() => {
//   const [formData, setFormData] = useState({} as { initialEquity?: number; preheatWeeks?: number });
//   const portfolioStatistics = useObservableState(portfolioStatistics$);
//   const results = useObservableState(batchBacktestResult$);

//   return (
//     <Space vertical align="start">
//       <Form
//         schema={{
//           type: 'object',
//           properties: {
//             initialEquity: {
//               type: 'number',
//               title: '期初账户净值'
//             },
//             preheatWeeks: {
//               type: 'number',
//               title: '预热周数'
//             }
//           }
//         }}
//         formData={formData}
//         onChange={(e) => {
//           setFormData(e.formData);
//         }}
//         uiSchema={{
//           'ui:submitButtonOptions': {
//             submitText: '启动投资组合模拟'
//           }
//         }}
//         onSubmit={(e) => {
//           if (results.length === 0) {
//             Toast.error('请先运行批量回测');
//             return;
//           }
//           const mergedAccountInfos$ = defer(() =>
//             portfolioSimulation(
//               { initEquity: formData.initialEquity || 430000, preheat_weeks: formData.preheatWeeks || 0 },
//               results.map((v) => v.shell)
//             )
//           ).pipe(
//             //
//             tap(() => {
//               Toast.success('投资组合模拟完成');
//             }),
//             shareReplay(1)
//           );

//           mergedAccountInfos$
//             .pipe(
//               //
//               first(),
//               map(({ statistics }) => statistics),
//               tap((statistics) => {
//                 console.info(statistics);
//                 portfolioStatistics$.next(statistics);
//               })
//             )
//             .subscribe();

//           mergedAccountInfos$
//             .pipe(
//               //
//               first(),
//               map(({ targetAccountInfoList }) => targetAccountInfoList),
//               mergeMap((v) => v),
//               filter((v) => v.timestamp_in_us > 0),
//               reduce(
//                 (acc, cur) => AccountPerformanceUnit.reduceAccountPerformance(acc, cur),
//                 AccountPerformanceUnit.makeInitAccountPerformance('@merged')
//               )
//             )
//             .subscribe((performance) => accountPerformance$.next(performance));

//           mergedAccountInfos$
//             .pipe(
//               //
//               first(),
//               map(({ targetHistoryOrders }) => targetHistoryOrders)
//             )
//             .subscribe((orders) => orders$.next(orders));

//           mergedAccountInfos$
//             .pipe(
//               first(),
//               map(({ targetAccountInfoList }) => targetAccountInfoList),
//               mergeMap((v) => v),
//               filter((info) => info.timestamp_in_us > 0),
//               map((info) => ({
//                 timestamp_in_us: info.timestamp_in_us,
//                 equity: info.money.equity,
//                 balance: info.money.balance,
//                 profit: info.money.profit,
//                 require: info.money.used - info.money.profit,
//                 margin: info.money.used
//               })),
//               distinct((v) => v.timestamp_in_us),
//               toArray()
//             )
//             .subscribe((frames) => {
//               accountFrameSeries$.next(frames);
//             });
//         }}
//       ></Form>
//       <table className="semi-table">
//         <thead className="semi-table-thead">
//           <tr className="semi-table-row">
//             {[
//               '时间戳',
//               '事件',
//               '统计类型',
//               '目标账户',
//               ...(portfolioStatistics.length !== 0
//                 ? Object.keys(
//                     portfolioStatistics[portfolioStatistics.length - 1].periodSourceAccountStatistics
//                   )
//                     .sort()
//                     .map((account_id) => `策略-${account_id}`)
//                 : [])
//             ].map((key, index) => {
//               return (
//                 <th
//                   className="semi-table-row-head"
//                   style={{
//                     position: 'sticky',
//                     top: 0,
//                     left: index === 0 ? 0 : undefined,
//                     zIndex: index === 0 ? 2 : 1,
//                     background: 'var(--semi-color-bg-2)'
//                   }}
//                 >
//                   {key}
//                 </th>
//               );
//             })}
//           </tr>
//         </thead>
//         <tbody className="semi-table-tbody">
//           {portfolioStatistics.length !== 0 && (
//             <tr className="semi-table-row">
//               <td className="semi-table-row-cell"></td>
//               <td className="semi-table-row-cell">期初</td>
//               <td className="semi-table-row-cell">净值</td>
//               <td className="semi-table-row-cell">
//                 {portfolioStatistics[0].periodStartTargetAccountInfo.money.equity.toFixed(2)}
//               </td>
//               {Object.entries(portfolioStatistics[0].periodSourceAccountStatistics)
//                 .sort(([a], [b]) => (a < b ? -1 : 1))
//                 .map(([, statistics]) => {
//                   return (
//                     <td className="semi-table-row-cell">
//                       {statistics.startAccountInfo.money.equity.toFixed(2)}
//                     </td>
//                   );
//                 })}
//             </tr>
//           )}
//           {portfolioStatistics.flatMap((element, idx) => {
//             return [
//               <tr
//                 className="semi-table-row"
//                 style={{ backgroundColor: idx % 2 ? 'var(--semi-color-fill-0)' : undefined }}
//               >
//                 <td className="semi-table-row-cell">{format(element.timestamp, 'yyyy-MM-dd HH:mm:ss')}</td>
//                 <td className="semi-table-row-cell">决策</td>
//                 <td className="semi-table-row-cell">系数</td>
//                 <td className="semi-table-row-cell"></td>
//                 {Object.entries(element.coefficients)
//                   .sort(([a], [b]) => (a < b ? -1 : 1))
//                   .map(([, coefficient]) => {
//                     return <td className="semi-table-row-cell">{coefficient.toFixed(5)}</td>;
//                   })}
//               </tr>,
//               <tr
//                 className="semi-table-row"
//                 style={{ backgroundColor: idx % 2 ? 'var(--semi-color-fill-0)' : undefined }}
//               >
//                 <td className="semi-table-row-cell">
//                   {format(element.periodEndTargetAccountInfo.timestamp_in_us / 1000, 'yyyy-MM-dd HH:mm:ss')}
//                 </td>
//                 <td className="semi-table-row-cell">结算</td>
//                 <td className="semi-table-row-cell">收益</td>
//                 <td
//                   className="semi-table-row-cell"
//                   style={{
//                     color:
//                       element.performance.equity - element.performance.opening_equity > 0 ? 'red' : 'green'
//                   }}
//                 >
//                   {(element.performance.equity - element.performance.opening_equity).toFixed(2)}
//                 </td>
//                 {Object.entries(element.periodSourceAccountStatistics)
//                   .sort(([a], [b]) => (a < b ? -1 : 1))
//                   .map(([, sourceStatistics]) => {
//                     return (
//                       <td className="semi-table-row-cell">
//                         {(
//                           sourceStatistics.performance.equity - sourceStatistics.performance.opening_equity
//                         ).toFixed(2)}
//                       </td>
//                     );
//                   })}
//               </tr>,
//               <tr
//                 className="semi-table-row"
//                 style={{ backgroundColor: idx % 2 ? 'var(--semi-color-fill-0)' : undefined }}
//               >
//                 <td className="semi-table-row-cell"></td>
//                 <td className="semi-table-row-cell">结算</td>
//                 <td className="semi-table-row-cell">净值</td>
//                 <td className="semi-table-row-cell">{element.performance.equity.toFixed(2)}</td>
//                 {Object.entries(element.periodSourceAccountStatistics)
//                   .sort(([a], [b]) => (a < b ? -1 : 1))
//                   .map(([, sourceStatistics]) => {
//                     return (
//                       <td className="semi-table-row-cell">
//                         {sourceStatistics.performance.equity.toFixed(2)}
//                       </td>
//                     );
//                   })}
//               </tr>,

//               <tr
//                 className="semi-table-row"
//                 style={{ backgroundColor: idx % 2 ? 'var(--semi-color-fill-0)' : undefined }}
//               >
//                 <td className="semi-table-row-cell"></td>
//                 <td className="semi-table-row-cell">结算</td>
//                 <td className="semi-table-row-cell">周收益率</td>
//                 <td className="semi-table-row-cell">
//                   {(element.performance.weekly_return_ratio * 100).toFixed(2)}%
//                 </td>
//                 {Object.entries(element.periodSourceAccountStatistics)
//                   .sort(([a], [b]) => (a < b ? -1 : 1))
//                   .map(([, sourceStatistics]) => {
//                     return (
//                       <td className="semi-table-row-cell">
//                         {(sourceStatistics.performance.weekly_return_ratio * 100).toFixed(2)}%
//                       </td>
//                     );
//                   })}
//               </tr>
//             ];
//           })}

//           {portfolioStatistics.length !== 0 && (
//             <tr className="semi-table-row">
//               <td className="semi-table-row-cell"></td>
//               <td className="semi-table-row-cell">期末</td>
//               <td className="semi-table-row-cell">净值</td>
//               <td className="semi-table-row-cell">
//                 {portfolioStatistics[
//                   portfolioStatistics.length - 1
//                 ].periodEndTargetAccountInfo.money.equity.toFixed(2)}
//               </td>
//               {Object.entries(
//                 portfolioStatistics[portfolioStatistics.length - 1].periodSourceAccountStatistics
//               )
//                 .sort(([a], [b]) => (a < b ? -1 : 1))
//                 .map(([, statistics]) => {
//                   return (
//                     <td className="semi-table-row-cell">
//                       {statistics.endAccountInfo.money.equity.toFixed(2)}
//                     </td>
//                   );
//                 })}
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </Space>
//   );
// });
