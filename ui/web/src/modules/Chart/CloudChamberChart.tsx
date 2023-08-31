export default {};
// import { Button, Col, Descriptions, Row, Switch, Typography } from '@douyinfe/semi-ui';
// import { ITrade, TradeDirection } from '@yuants/protocol';
// import React, { useCallback, useMemo, useState } from 'react';
// import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

// const { Title } = Typography;
// export const CloudChamberChart = React.memo(() => {
//   const trades: ITrade[] = [];

//   const [script, setScript] = useState('');

//   const connectToWorkspace = async () => {
//     const fileHandles: FileSystemFileHandle[] = await showOpenFilePicker();
//     const file = await fileHandles[0].getFile();
//     setScript(await file.text());
//   };

//   const closePriceData: { time: number; close: number; idx: number }[] = [];

//   //TODO 指标传给止盈止损脚本
//   // const RISIndicator = useCallback(() => {
//   //   const indicatorHook = instance.hooks.find(
//   //     (hook): hook is Indicator => hook instanceof Indicator && hook.params[0] === 'RSI'
//   //   );
//   //   if (indicatorHook) {
//   //     const [RSI] = indicatorHook.output;
//   //     return RSI;
//   //   }
//   //   return [];
//   // }, [instance]);

//   const [newTrades, chartData, stopProfixCount, stopLossCount] = useMemo(() => {
//     const data: Array<Record<string, number>> = [];
//     const beenStopedLossOrProfit: Record<string, boolean> = {};
//     let stopProfixCount = 0;
//     let stopLossCount = 0;
//     type ITradeSome = ITrade & {
//       lossAlltheTime: boolean;
//       winAlltheTime: boolean;
//       lossAtTheEnd: boolean;
//       winAtTheEnd: boolean;
//       _profit: number;
//     };

//     const newTrades: ITradeSome[] = trades.map((trade, tradeIndex): ITradeSome => {
//       // 增加profit字段记录止盈止损位置的收益
//       let _profit = 0;
//       let lossAlltheTime = true;
//       let winAlltheTime = true;
//       closePriceData
//         .slice(
//           closePriceData.findIndex(
//             (priceData, index) =>
//               priceData.time <= trade.open_timestamp_in_us &&
//               closePriceData[index + 1].time > trade.open_timestamp_in_us
//           ),
//           closePriceData.findIndex(
//             (priceData, index) =>
//               priceData.time > trade.close_timestamp_in_us &&
//               closePriceData[index - 1].time <= trade.close_timestamp_in_us
//           )
//         )
//         .forEach((closePriceData, index) => {
//           if (!data[index]) {
//             data[index] = {};
//           }
//           const profit =
//             (closePriceData.close - trade.open_price) *
//             { [TradeDirection.LONG]: 1, [TradeDirection.SHORT]: -1 }[trade.direction];
//           if (script) {
//             //TD 这里会传入所需要的指标，可以在脚本中写更复杂的止盈止损逻辑
//             const stopProfitAndLossFn = new Function(script);
//             //计算止盈止损值
//             const [stopProfixP, stopLossP] = stopProfitAndLossFn();
//             //记录画线
//             data[index][`stopProfit_${tradeIndex}`] = stopProfixP;
//             data[index][`stopLoss_${tradeIndex}`] = stopLossP;
//             if (profit < stopProfixP && profit > stopLossP && !beenStopedLossOrProfit[tradeIndex]) {
//               _profit = profit;
//             } else {
//               //判断是否是第一次止盈或者止损，如果不是，则不用做任何操作
//               if (!beenStopedLossOrProfit[tradeIndex]) {
//                 if (profit > stopProfixP) {
//                   _profit = stopProfixP;
//                   stopProfixCount++;
//                 } else {
//                   _profit = stopLossP;
//                   stopLossCount++;
//                 }
//                 beenStopedLossOrProfit[tradeIndex] = true;
//               }
//             }
//           }
//           data[index][tradeIndex] = profit;
//           if (profit > 0) {
//             lossAlltheTime = false;
//           }
//           if (profit < 0) {
//             winAlltheTime = false;
//           }
//         });
//       const profit =
//         (trade.close_price - trade.open_price) *
//         { [TradeDirection.LONG]: 1, [TradeDirection.SHORT]: -1 }[trade.direction];

//       return {
//         ...trade,
//         lossAlltheTime,
//         winAlltheTime,
//         lossAtTheEnd: profit < 0,
//         winAtTheEnd: profit > 0,
//         _profit: _profit
//       };
//     });
//     return [newTrades, data, stopProfixCount, stopLossCount];
//   }, [closePriceData, trades, script]);

//   const descriptionsData = [
//     {
//       key: '止盈次数',
//       value: stopProfixCount
//     },
//     {
//       key: '止损次数',
//       value: stopLossCount
//     },
//     {
//       key: '总净值',
//       value: newTrades.reduce((sum, cur) => cur._profit + sum, 0)
//     }
//   ];

//   //显示一直亏损
//   const [showLossAllTheTimeState, setShowLossAllTheTimeState] = useState(false);
//   const showLossAllTheTime = useCallback(() => {
//     setShowLossAllTheTimeState((state) => !state);
//   }, [setShowLossAllTheTimeState]);
//   // 显示一直盈利部分
//   const [showWinAllTheTimeState, setShowWinAllTheTimeState] = useState(false);
//   const showWinAllTheTime = useCallback(() => {
//     setShowWinAllTheTimeState((state) => !state);
//   }, [setShowWinAllTheTimeState]);

//   //显示最终是亏损但不是一直亏损的部分
//   const [showLossAtTheEndExcludeAllTheTimeState, setShowLossAtTheEndExcludeAllTheTimeState] = useState(false);
//   // 显示最终是亏损但不是一直亏损的部分
//   const showLossAtTheEndExcludeAllTheTime = useCallback(
//     (checked: boolean) => {
//       setShowLossAtTheEndExcludeAllTheTimeState(checked);
//     },
//     [setShowLossAtTheEndExcludeAllTheTimeState]
//   );

//   //显示最终是亏损但不是一直亏损的部分
//   const [showWinAtTheEndExcludeAllTheTimeState, setShowWinAtTheEndExcludeAllTheTimeState] = useState(false);
//   // 显示最终是亏损但不是一直亏损的部分
//   const showWinAtTheEndExcludeAllTheTime = useCallback(
//     (checked: boolean) => {
//       setShowWinAtTheEndExcludeAllTheTimeState(checked);
//     },
//     [setShowWinAtTheEndExcludeAllTheTimeState]
//   );

//   //显示所有
//   const [showAllState, setShowAllState] = useState(false);
//   const showAll = useCallback(() => {
//     setShowAllState((state) => {
//       setShowWinAllTheTimeState(!state);
//       setShowLossAllTheTimeState(!state);
//       setShowLossAtTheEndExcludeAllTheTimeState(!state);
//       setShowWinAtTheEndExcludeAllTheTimeState(!state);
//       return !state;
//     });
//   }, [setShowWinAllTheTimeState, setShowLossAllTheTimeState, setShowLossAtTheEndExcludeAllTheTimeState]);

//   const shouldDisplayTheLine = useCallback(
//     (
//       trade: ITrade & {
//         lossAlltheTime: boolean;
//         winAlltheTime: boolean;
//         lossAtTheEnd: boolean;
//         winAtTheEnd: boolean;
//       }
//     ) => {
//       // 是否显示亏损但不是一直亏损部分
//       if (trade.lossAtTheEnd && !trade.lossAlltheTime) {
//         if (showLossAtTheEndExcludeAllTheTimeState) {
//           return true;
//         } else {
//           return false;
//         }
//       }
//       if (trade.winAtTheEnd && !trade.winAlltheTime) {
//         if (showWinAtTheEndExcludeAllTheTimeState) {
//           return true;
//         } else {
//           return false;
//         }
//       }
//       if (trade.lossAlltheTime) {
//         if (showLossAllTheTimeState) {
//           return true;
//         } else {
//           return false;
//         }
//       }
//       if (trade.winAlltheTime) {
//         if (showWinAllTheTimeState) {
//           return true;
//         } else {
//           return false;
//         }
//       }
//       return showAllState;
//     },
//     [
//       showLossAllTheTimeState,
//       showWinAllTheTimeState,
//       showAllState,
//       showLossAtTheEndExcludeAllTheTimeState,
//       showWinAtTheEndExcludeAllTheTimeState
//     ]
//   );
//   return (
//     <div>
//       <div>
//         <div style={{ display: 'flex', alignItems: 'center' }}>
//           <Title heading={6} style={{ margin: 8 }}>
//             {showAllState ? '显示所有' : '移除所有'}
//           </Title>
//           <Switch checked={showAllState} onChange={showAll} aria-label="a switch for demo" />
//           <Title heading={6} style={{ margin: 8 }}>
//             一直盈利部分
//           </Title>
//           <Switch onChange={showWinAllTheTime} checked={showWinAllTheTimeState}></Switch>
//           <Title heading={6} style={{ margin: 8 }}>
//             一直亏损部分
//           </Title>
//           <Switch onChange={showLossAllTheTime} checked={showLossAllTheTimeState}></Switch>
//           <Title heading={6} style={{ margin: 8 }}>
//             盈利但非一直盈利部分
//           </Title>
//           <Switch
//             onChange={showWinAtTheEndExcludeAllTheTime}
//             checked={showWinAtTheEndExcludeAllTheTimeState}
//           ></Switch>
//           <Title heading={6} style={{ margin: 8 }}>
//             亏损但非一直亏损部分
//           </Title>
//           <Switch
//             onChange={showLossAtTheEndExcludeAllTheTime}
//             checked={showLossAtTheEndExcludeAllTheTimeState}
//           ></Switch>
//         </div>
//         {/* <Switch onChange={showAll}>显示/移除 所有</Switch> */}
//       </div>
//       <Row>
//         <Col span={16}>
//           <LineChart
//             width={700}
//             height={550}
//             data={chartData.map((v, i) => ({ ...v, x: i, name: i }))}
//             margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="x" />
//             <YAxis />
//             {newTrades.map((trade, index) => {
//               return (
//                 shouldDisplayTheLine(trade) && (
//                   <>
//                     <Line
//                       key={trade.open_timestamp_in_us}
//                       type="monotone"
//                       dataKey={index}
//                       stroke={
//                         trade.lossAlltheTime
//                           ? '#ff0000'
//                           : trade.winAlltheTime
//                           ? '#00ff00'
//                           : trade.winAtTheEnd
//                           ? '#0000ff'
//                           : trade.lossAtTheEnd
//                           ? '#dd7e6b'
//                           : '#8884d8'
//                       }
//                       dot={false}
//                     />
//                     <Line
//                       key={`stopProfit_${index}`}
//                       type="monotone"
//                       dataKey={`stopProfit_${index}`}
//                       stroke={'#000000'}
//                       dot={false}
//                     />
//                     <Line
//                       key={`stopLoss_${index}`}
//                       type="monotone"
//                       dataKey={`stopLoss_${index}`}
//                       stroke={'#000000'}
//                       dot={false}
//                     />
//                   </>
//                 )
//               );
//             })}
//           </LineChart>
//         </Col>
//         <Col span={8}>
//           <Row>
//             <Button onClick={connectToWorkspace}>选择止盈止损脚本</Button>
//           </Row>
//           <Row>
//             <Col>
//               <Descriptions data={descriptionsData} />
//             </Col>
//           </Row>
//         </Col>
//       </Row>
//     </div>
//   );
// });
