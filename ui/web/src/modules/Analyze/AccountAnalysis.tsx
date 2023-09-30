export {};
// import { Button, Card, Progress, Space, Table, Toast } from '@douyinfe/semi-ui';
// import Meta from '@douyinfe/semi-ui/lib/es/card/meta';
// import { IPerformance } from '@yuants/shell';
// import { useObservableState } from 'observable-hooks';
// import React, { useMemo, useState } from 'react';
// import {
//   EMPTY,
//   catchError,
//   concatMap,
//   filter,
//   first,
//   from,
//   map,
//   mergeAll,
//   mergeMap,
//   of,
//   scan,
//   switchMap,
//   tap,
//   throwIfEmpty
// } from 'rxjs';
// import YAML from 'yaml';
// import { terminal$ } from '../Terminals';
// import { batchReplayAccount } from '../../common/replay-account';
// import { PERIOD_IN_SEC_TO_LABEL } from '../../common/utils';
// import { accountIds$ } from '../AccountInfo/model';
// import { fs } from '../FileSystem/api';
// import Form from '../Form';

// export const AccountAnalysisTable = React.memo(() => {
//   const accountList = useObservableState(accountIds$, []);

//   const [formData, setFormData] = useState({
//     configFilePath: '',
//     datasource_id: '',
//     period_in_sec: 0,
//     start_time: undefined as string | undefined,
//     end_time: undefined as string | undefined
//   });

//   const [replayProgress, setReplayProgress] = useState(0);
//   const [pullProgress, setPullProgress] = useState(0);

//   const [performanceList, setPerformanceList] = useState<IPerformance[]>([]);

//   const scroll = useMemo(() => ({ y: 600, x: 1500 }), []);

//   return (
//     <Space vertical align="start">
//       <Form
//         schema={{
//           type: 'object',
//           properties: {
//             configFilePath: {
//               type: 'string',
//               title: '配置文件路径'
//             },
//             datasource_id: {
//               type: 'string',
//               title: '数据源',
//               enum: accountList
//             },
//             start_time: {
//               type: 'string',
//               title: '开始时间',
//               description: '请按照您的本地时区填写',
//               format: 'date-time'
//             },
//             end_time: {
//               type: 'string',
//               title: '结束时间',
//               description: '请按照您的本地时区填写',
//               format: 'date-time'
//             }
//           }
//         }}
//         onChange={(e) => {
//           setFormData(e.formData);
//         }}
//         formData={formData}
//         uiSchema={{
//           'ui:submitButtonOptions': {
//             submitText: '加载回放配置'
//           }
//         }}
//         onSubmit={(e) => {
//           of(formData)
//             .pipe(
//               //
//               switchMap(({ configFilePath }) => fs.readFile(configFilePath)),
//               mergeMap((content) =>
//                 from([YAML.parse, JSON.parse]).pipe(
//                   //
//                   map(
//                     (
//                       parser: (content: string) => {
//                         product_id_mapping: Record<string, string | undefined>;
//                         account_ids: string[];
//                       }
//                     ) => parser(content)
//                   ),
//                   catchError((e) => EMPTY),
//                   first(),
//                   throwIfEmpty()
//                 )
//               )
//             )
//             .subscribe({
//               error: (e) => {
//                 Toast.error(`配置加载失败: ${e}`);
//               },
//               next: (config) => {
//                 Toast.success('配置加载成功');
//                 const performance$ = batchReplayAccount(
//                   config,
//                   formData.datasource_id,
//                   formData.start_time ? new Date(formData.start_time!).getTime() * 1000 : 0,
//                   formData.end_time ? new Date(formData.end_time!).getTime() * 1000 : Date.now() * 1000
//                 );
//                 let cnt = 0;
//                 performance$
//                   .pipe(
//                     //
//                     tap(() => {
//                       cnt++;
//                       setReplayProgress(+((cnt / config.account_ids.length) * 100).toFixed(2));
//                     }),
//                     scan((acc, cur) => [...acc, cur], [] as IPerformance[])
//                   )
//                   .subscribe((v) => {
//                     setPerformanceList(v);
//                   });
//               }
//             });
//         }}
//       ></Form>
//       <Space>
//         <Button
//           onClick={(e) => {
//             let cnt = 0;
//             let total = 0;
//             of(formData)
//               .pipe(
//                 //
//                 switchMap(({ configFilePath }) => fs.readFile(configFilePath)),
//                 mergeMap((content) =>
//                   from([YAML.parse, JSON.parse]).pipe(
//                     //
//                     map(
//                       (
//                         parser: (content: string) => {
//                           product_id_mapping: Record<string, string | undefined>;
//                           account_ids: string[];
//                         }
//                       ) => parser(content)
//                     ),
//                     catchError((e) => EMPTY),
//                     first(),
//                     throwIfEmpty()
//                   )
//                 ),
//                 map((config) => Object.values(config.product_id_mapping)),
//                 tap((v) => {
//                   total = v.length;
//                 }),
//                 mergeAll(),
//                 filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
//                 // TODO: 在数据录制之后删除
//                 concatMap((product_id) => {
//                   cnt++;
//                   return terminal$.pipe(
//                     //
//                     first(),
//                     concatMap((term) =>
//                       from(Object.keys(PERIOD_IN_SEC_TO_LABEL)).pipe(
//                         //
//                         concatMap((period_in_sec) =>
//                           term.queryPeriods(
//                             {
//                               datasource_id: formData.datasource_id,
//                               product_id,
//                               period_in_sec: +period_in_sec,
//                               start_time_in_us: formData.start_time
//                                 ? new Date(formData.start_time!).getTime() * 1000
//                                 : 0,
//                               end_time_in_us: formData.end_time
//                                 ? new Date(formData.end_time!).getTime() * 1000
//                                 : Date.now() * 1000,
//                               pull_source: true
//                             },
//                             'MongoDB'
//                           )
//                         )
//                       )
//                     )
//                   );
//                 }),
//                 tap(() => {
//                   setPullProgress(+((cnt / total) * 100).toFixed(2));
//                 })
//               )
//               .subscribe({
//                 error: (e) => {
//                   Toast.error(`配置加载失败: ${e}`);
//                 }
//               });
//           }}
//         >
//           拉取数据
//         </Button>
//         <Progress percent={pullProgress} type="circle" showInfo={true}></Progress>
//       </Space>
//       <Card
//         style={{ maxWidth: 360 }}
//         bodyStyle={{
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between'
//         }}
//       >
//         <Meta title="回放进度" />
//         <Progress percent={replayProgress} type="circle" showInfo={true}></Progress>
//       </Card>
//       <Table
//         dataSource={performanceList}
//         pagination={false}
//         scroll={scroll}
//         style={{ width: 1500 }}
//         columns={[
//           {
//             title: '账户',
//             fixed: true,
//             width: 250,
//             render: (_, performance) => performance.account_id
//           },
//           {
//             title: '净收益',
//             width: 150,
//             render: (_, performance) => performance.net_value.toFixed(5)
//           },
//           {
//             title: '总成交量',
//             width: 150,
//             render: (_, performance) => performance.total_volume.toFixed(5)
//           },
//           {
//             title: '跨越自然日',
//             width: 150,
//             render: (_, performance) => performance.duration_of_trades_in_day
//           },
//           {
//             title: '总盈利',
//             width: 150,
//             render: (_, performance) => performance.gross_profit.toFixed(5)
//           },
//           {
//             title: '总亏损',
//             width: 150,
//             render: (_, performance) => performance.gross_loss.toFixed(5)
//           },
//           {
//             title: '盈利次数',
//             width: 150,
//             render: (_, performance) => performance.win_trade_number
//           },
//           {
//             title: '亏损次数',
//             width: 150,
//             render: (_, performance) => performance.lose_trade_number
//           },
//           {
//             title: '胜率',
//             width: 150,
//             render: (_, performance) => performance.winning_percentage.toFixed(5)
//           },
//           {
//             title: '平均盈利',
//             width: 150,
//             render: (_, performance) => performance.mean_net_profit.toFixed(5)
//           },
//           {
//             title: '盈利标准差',
//             width: 150,
//             render: (_, performance) => performance.stddev_net_profit.toFixed(5)
//           },
//           {
//             title: '平均持仓时间(s)',
//             width: 150,
//             render: (_, performance) => ~~(performance.mean_trade_duration / 1e6)
//           },
//           {
//             title: '持仓时间标准差(s)',
//             width: 150,
//             render: (_, performance) => ~~(performance.stddev_trade_duration / 1e6)
//           },
//           {
//             title: '最大持仓',
//             width: 150,
//             render: (_, performance) => performance.max_position
//           },
//           {
//             title: '收益回撤比',
//             width: 150,
//             render: (_, performance) => performance.net_profit_max_drawdown_profit_ratio.toFixed(5)
//           },
//           {
//             title: '最大余额回撤',
//             width: 150,
//             render: (_, performance) => performance.max_drawdown_profit.toFixed(5)
//           },
//           {
//             title: '总 PP',
//             width: 150,
//             render: (_, performance) => performance.pp.toFixed(5)
//           },
//           {
//             title: '最大使用的保证金',
//             width: 150,
//             render: (_, performance) => performance.max_margin.toFixed(5)
//           },
//           {
//             title: '最近 6 周 PP',
//             width: 150,
//             render: (_, performance) => performance.pp_last_6_weeks.toFixed(5)
//           },
//           {
//             title: '最近 6 周最大使用的保证金',
//             width: 150,
//             render: (_, performance) => performance.max_margin_last_6_weeks.toFixed(5)
//           },
//           {
//             title: '每 6 周 PP 均值',
//             width: 150,
//             render: (_, performance) => performance.mean_pp_each_6_weeks.toFixed(5)
//           },
//           {
//             title: '每 6 周 PP 标准差',
//             width: 150,
//             render: (_, performance) => performance.stddev_pp_each_6_weeks.toFixed(5)
//           },
//           {
//             title: '每 6 周 PP P50 分位数',
//             width: 150,
//             render: (_, performance) => performance.p50_pp_each_6_weeks.toFixed(5)
//           },
//           {
//             title: '每 6 周 PP P90 分位数',
//             width: 150,
//             render: (_, performance) => performance.p90_pp_each_6_weeks.toFixed(5)
//           },
//           {
//             title: '每 6 周 PP P99 分位数',
//             width: 150,
//             render: (_, performance) => performance.p99_pp_each_6_weeks.toFixed(5)
//           }
//         ]}
//       ></Table>
//     </Space>
//   );
// });
