// import { distinct, filter, from, map, mergeMap, toArray } from 'rxjs';
// import { client } from './api';

// /**
//  * 设置超级保证金账户的 WebSocket 订阅
//  */
// export const setupSuperMarginWebSocketSubscriptions = (
//   superMarginAccountBalance$: ReturnType<typeof getSuperMarginAccountBalance$>,
//   subscriptions: Set<string>,
// ) => {
//   from(client.spot_ws.connection$).subscribe(() => {
//     subscriptions.clear();
//   });
//   // subscribe the symbols of positions we held
//   superMarginAccountBalance$
//     .pipe(
//       //
//       mergeMap((res) =>
//         from(res?.list || []).pipe(
//           filter((v) => v.currency !== 'usdt'),
//           map((v) => v.currency),
//           distinct(),
//           toArray(),
//           map((v) => new Set(v)),
//         ),
//       ),
//     )
//     .subscribe((v: Set<string>) => {
//       const toUnsubscribe = [...subscriptions].filter((x) => !v.has(x));
//       const toSubscribe = [...v].filter((x) => !subscriptions.has(x));

//       for (const symbol of toUnsubscribe) {
//         client.spot_ws.output$.next({
//           unsub: `market.${symbol}usdt.ticker`,
//         });
//         subscriptions.delete(symbol);
//       }
//       for (const symbol of toSubscribe) {
//         client.spot_ws.output$.next({
//           sub: `market.${symbol}usdt.ticker`,
//         });
//         subscriptions.add(symbol);
//       }
//     });
// };
