export default {};
// import { Space, Typography } from '@douyinfe/semi-ui';
// import React, { useState } from 'react';
// import { CartesianGrid, Label, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
// import Form from '../Form';

// export const StopLossAnalyzer = React.memo(() => {
//   const [data, setData] = useState<{ x: number; y: number }[]>([]);
//   const [formData, setFormData] = useState(0);
//   return (
//     <Space vertical align="start">
//       <Form
//         schema={{
//           type: 'number',
//           title: '采样次数'
//         }}
//         onChange={(x) => setFormData(x.formData)}
//         formData={formData}
//         uiSchema={{
//           'ui:submitButtonOptions': {
//             submitText: '开始止损模拟'
//           }
//         }}
//         onSubmit={(e) => {
//           // if (!currentShell) {
//           //   Toast.error('请先运行回测');
//           //   return;
//           // }
//           //
//           // const mapProductIDToProduct: Record<string, IProduct> = Object.fromEntries(
//           //   currentShell.products.map((p) => [p.product_id, p])
//           // );
//           // of(formData)
//           //   .pipe(
//           //     //
//           //     mergeMap((samples) => {
//           //       const maxMaintenanceMargin = currentShell.performance.max_maintenance_margin;
//           //       const accountInfoList = currentShell.accountInfoList;
//           //       const account_id = currentShell.resolved_account_id;
//           //       return generate({
//           //         initialState: 0,
//           //         condition: (x) => x < samples,
//           //         iterate: (x) => x + 1,
//           //         // resultSelector: (x: number) => x * (maxMaintenanceMargin / samples)
//           //         resultSelector: (x: number) => maxMaintenanceMargin ** ((x + 1) / samples)
//           //       }).pipe(
//           //         mergeMap((stopLoss) =>
//           //           from(accountInfoList).pipe(
//           //             //
//           //             stopLossMapper(stopLoss, mapProductIDToProduct),
//           //             reduce(
//           //               (acc, { account_info, stop_loss_count }) => {
//           //                 return {
//           //                   performance: reduceAccountPerformance(acc.performance, account_info),
//           //                   stop_loss_count: stop_loss_count
//           //                 };
//           //               },
//           //               {
//           //                 performance: makeInitAccountPerformance(account_id),
//           //                 stop_loss_count: 0
//           //               }
//           //             ),
//           //             map(({ performance, stop_loss_count }) => ({
//           //               x: stopLoss,
//           //               y: 700 / performance.payback_period_in_days
//           //             }))
//           //           )
//           //         ),
//           //         toArray()
//           //       );
//           //     })
//           //   )
//           //   .subscribe((data) => {
//           //     setData(data);
//           //   });
//         }}
//       ></Form>
//       <Typography.Text>研究止损(X)与周收益率(Y)的关系</Typography.Text>
//       <LineChart width={1200} height={550} data={data} margin={{ top: 50, right: 50, left: 50, bottom: 50 }}>
//         <CartesianGrid strokeDasharray="3 3" />
//         <XAxis dataKey="x">
//           <Label value="止损" offset={0} position="bottom" />
//         </XAxis>
//         <YAxis label={{ value: '周收益率', angle: -90, position: 'left' }} unit="%"></YAxis>
//         <Line type="monotone" dataKey={'y'} stroke={'#ff0000'} dot={true} />
//         <Tooltip></Tooltip>
//       </LineChart>
//     </Space>
//   );
// });
