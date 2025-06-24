export {};
// import { Toast } from '@douyinfe/semi-ui';
// import {
//   EventBusSubject,
//   IEvent,
//   IPerformance,
//   applyToAccount,
//   createEmptyAccountInfo,
//   performanceFromEventBus
// } from '@yuants/shell';
// import {
//   EMPTY,
//   Observable,
//   combineLatestWith,
//   concatMap,
//   concatWith,
//   filter,
//   find,
//   first,
//   forkJoin,
//   from,
//   groupBy,
//   map,
//   merge,
//   mergeMap,
//   of,
//   reduce,
//   share,
//   tap,
//   toArray
// } from 'rxjs';
// import { terminal$ } from './create-connection';
// import { PERIOD_IN_SEC_TO_LABEL } from './utils';

// interface PeriodTask {
//   product_id: string;
//   start_timestamp_in_us: number;
// }

// export const batchReplayAccount = (
//   config: { account_ids: string[]; product_id_mapping: Record<string, string | undefined> },
//   datasource_id: string,
//   start_timestamp_in_us: number,
//   end_timestamp_in_us: number
// ): Observable<IPerformance> => {
//   return from(config.account_ids).pipe(
//     map((account_id) => createEmptyAccountInfo(account_id, 'USD', 500)),
//     mergeMap((accountInfo) => {
//       const products$ = useProducts(datasource_id).pipe(
//         //
//         first()
//       );
//       const eventBus = new EventBusSubject();

//       applyToAccount(eventBus, config.product_id_mapping);

//       const performance = performanceFromEventBus(accountInfo.account_id, eventBus);

//       const orders$ = terminal$.pipe(
//         //
//         first(),
//         mergeMap((terminal) =>
//           terminal.queryHistoryOrders(
//             {
//               account_id: accountInfo.account_id
//             },
//           )
//         ),
//         share()
//       );

//       const tasks$ = orders$.pipe(
//         mergeMap((v) => v),
//         groupBy((order) => order.product_id),
//         mergeMap((group) => {
//           // 寻找相关品种的配置
//           const product_id = group.key;
//           const theProduct$ = products$.pipe(
//             mergeMap((v) => v),
//             find((product) => product.product_id === product_id),
//             share()
//           );

//           const baseProduct$ = products$.pipe(
//             mergeMap((v) => v),
//             combineLatestWith(theProduct$),
//             find(([product, theProduct]) => {
//               const currency = accountInfo.money.currency;
//               if (theProduct?.base_currency && theProduct.base_currency !== currency) {
//                 if (
//                   theProduct.base_currency == product.base_currency &&
//                   currency === product.quoted_currency
//                 ) {
//                   return true;
//                 }
//                 if (
//                   product.base_currency === currency &&
//                   product.quoted_currency === theProduct.base_currency
//                 ) {
//                   return true;
//                 }
//               }
//               return false;
//             }),
//             map((x) => x?.[0]),
//             share()
//           );

//           const startTimeStampInUs$ = group.pipe(
//             reduce((acc, cur) => Math.min(acc, cur.timestamp_in_us!), Date.now() * 1000),
//             share()
//           );

//           return forkJoin([theProduct$, baseProduct$, startTimeStampInUs$]).pipe(
//             map(([theProduct, baseProduct, startTimestampInUs]) =>
//               ([] as PeriodTask[]).concat(
//                 //
//                 theProduct
//                   ? [{ product_id: theProduct.product_id, start_timestamp_in_us: startTimestampInUs }]
//                   : [],
//                 baseProduct
//                   ? [
//                       {
//                         product_id: baseProduct.product_id,
//                         start_timestamp_in_us: startTimestampInUs
//                       }
//                     ]
//                   : []
//               )
//             )
//           );
//         }),
//         mergeMap((v) => v),
//         // 去重, 合并 Task
//         groupBy((task) => task.product_id),
//         mergeMap((group) =>
//           //
//           group.pipe(
//             //
//             reduce((acc, cur) => Math.min(acc, cur.start_timestamp_in_us), Date.now() * 1000),
//             map((start_timestamp_in_us): PeriodTask => ({ product_id: group.key, start_timestamp_in_us }))
//           )
//         ),
//         toArray(),
//         share()
//       );

//       const periodsEvent$ = tasks$.pipe(
//         tap((tasks) => Toast.info(`需要拉取 ${tasks.length} 组历史数据`)),
//         mergeMap((v) => v),
//         concatMap(({ product_id, start_timestamp_in_us }) =>
//           terminal$.pipe(
//             first(),
//             mergeMap((terminal) =>
//               from(Object.keys(PERIOD_IN_SEC_TO_LABEL)).pipe(
//                 mergeMap(
//                   (period_in_sec) =>
//                     terminal.queryPeriods(
//                       {
//                         datasource_id,
//                         period_in_sec: +period_in_sec,
//                         product_id,
//                         start_time_in_us: start_timestamp_in_us,
//                         end_time_in_us: Date.now() * 1000,
//                         pull_source: false
//                       },
//                     ),
//                   4
//                 )
//               )
//             ),
//             //
//             tap((periods) => Toast.success(`成功拉取 ${product_id} ${periods.length} 条数据`))
//           )
//         ),
//         mergeMap((x) => x),
//         map(
//           (period): IEvent => ({
//             timestamp_in_us: period.timestamp_in_us,
//             tick: {
//               timestamp_in_us: period.timestamp_in_us,
//               datasource_id: period.datasource_id,
//               product_id: period.product_id,
//               price: period.open,
//               volume: 0
//             }
//           })
//         ),
//         share()
//       );
//       const productEvent$ = products$.pipe(
//         //
//         map((products): IEvent => ({ timestamp_in_us: 0, products }))
//       );

//       const orderEvent$ = orders$.pipe(
//         //
//         mergeMap((v) => v),
//         map((order): IEvent => ({ timestamp_in_us: order.timestamp_in_us!, order }))
//       );

//       const event$ = merge([
//         productEvent$,
//         orderEvent$,
//         periodsEvent$,
//         of({
//           timestamp_in_us: accountInfo.timestamp_in_us,
//           accountInfo
//         })
//       ]).pipe(
//         mergeMap((v) => v),
//         filter(
//           (e) =>
//             e.timestamp_in_us === 0 ||
//             (start_timestamp_in_us <= e.timestamp_in_us && e.timestamp_in_us < end_timestamp_in_us)
//         ),
//         share()
//       );
//       event$.subscribe({
//         next: (e) => {
//           eventBus.next(e);
//         },
//         error: (e) => {
//           eventBus.error(e);
//         },
//         complete: () => {
//           eventBus.next({
//             timestamp_in_us: 0,
//             control: 'start'
//           });
//           eventBus.complete();
//         }
//       });

//       return event$.pipe(
//         //
//         mergeMap((e) => EMPTY),
//         concatWith(performance)
//       );
//     }, 4)
//   );
// };
