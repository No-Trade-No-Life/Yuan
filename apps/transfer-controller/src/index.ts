import {
  IAccountAddressInfo,
  IDataRecord,
  ITransferNetworkInfo,
  ITransferOrder,
  encodePath,
  formatTime,
} from '@yuants/data-model';

import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/transfer';

import { Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import {
  Observable,
  OperatorFunction,
  Subject,
  Subscription,
  catchError,
  concatWith,
  defaultIfEmpty,
  defer,
  delayWhen,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  of,
  pipe,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
// @ts-ignore
import dijkstra from 'dijkstrajs';

interface ITransferPair {
  /** 发起转账的账户ID */
  tx_account_id?: string;
  /** 查收转账的账户ID */
  rx_account_id?: string;
  /** 发起转账的地址 */
  tx_address?: string;
  /** 查收转账的地址 */
  rx_address?: string;
  /** 网络 ID */
  network_id?: string;
}

interface ITransferRoutingCache {
  credit_account_id: string;
  debit_account_id: string;
  routing_path: ITransferPair[];
}

const HOST_URL = process.env.HOST_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || 'TransferController';

const terminal = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Transfer Controller',
});

/**
 * listWatch is to listen to a specific type of data records and consume them
 *
 * @param hashKey - hashKey function to group items
 * @param consumer - for each group, consume the items
 */
const listWatch = <T, K>(
  hashKey: (item: T) => string,
  consumer: (item: T) => Observable<K>,
): OperatorFunction<T[], K> =>
  pipe(
    batchGroupBy(hashKey),
    mergeMap((group) =>
      group.pipe(
        // Take first but not complete until group complete
        distinctUntilChanged(() => true),
        switchMapWithComplete(consumer),
      ),
    ),
  );

defer(() =>
  terminal.queryDataRecords<ITransferOrder>({
    type: 'transfer_order',
  }),
)
  .pipe(
    //
    map((v) => v.origin),
    filter((order) => !['ERROR', 'COMPLETE', 'AWAIT_DEBIT', 'AWAIT_CREDIT'].includes(order.status!)),
    toArray(),
    retry({ delay: 5_000 }),
    repeat({ delay: 30_000 }),
  )
  .pipe(
    listWatch(
      (order) => `${order.order_id}`,
      (order) => processTransfer(order),
    ),
  )
  .subscribe();

const makeRoutingPath = async (order: ITransferOrder): Promise<ITransferPair[] | undefined> => {
  const serializeAccountIdNode = (account_id: string) =>
    JSON.stringify({
      namespace: 'account_id',
      key: account_id,
    });

  const serializeNetworkIdNode = (network_id: string) =>
    JSON.stringify({
      namespace: 'network',
      key: network_id,
    });

  const serializeAddressNode = (network_id: string, address: string) =>
    JSON.stringify({
      namespace: encodePath('address', network_id),
      key: address,
    });

  const slidingWithStep = <T>(array: T[], size: number, step: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i <= array.length - size; i += step) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  const extractKey = (serialized: string) => JSON.parse(serialized).key;

  const { credit_account_id, debit_account_id } = order;
  const addressInfoList = await firstValueFrom(
    defer(() =>
      terminal.queryDataRecords<IAccountAddressInfo>({
        type: 'account_address_info',
      }),
    ).pipe(
      //
      map((v) => v.origin),
      toArray(),
    ),
  );

  const transferNetworkInfoList = await firstValueFrom(
    defer(() =>
      terminal.queryDataRecords<ITransferNetworkInfo>({
        type: 'transfer_network_info',
      }),
    ).pipe(
      //
      map((v) => v.origin),
      toArray(),
      shareReplay(1),
    ),
  );

  const mapNetworkIdToNetworkInfo: Record<string, ITransferNetworkInfo> = Object.fromEntries(
    transferNetworkInfoList.map((v) => [v.network_id, v]),
  );

  const adjacencyList: Record<string, Record<string, number>> = {};

  const sameAccountInfos = Object.entries(
    addressInfoList.reduce((acc, info) => {
      (acc[info.account_id] ??= []).push(info);
      return acc;
    }, {} as Record<string, IAccountAddressInfo[]>),
  );

  sameAccountInfos.forEach(([account_id, infos]) => {
    adjacencyList[serializeAccountIdNode(account_id)] = Object.fromEntries(
      infos.map((info) => [serializeAddressNode(info.network_id, info.address), 0]),
    );
    for (const info of infos) {
      (adjacencyList[serializeAddressNode(info.network_id, info.address)] ??= {})[
        serializeAccountIdNode(account_id)
      ] = 0;
    }
  });

  const sameNetworkInfos = Object.entries(
    addressInfoList.reduce((acc, info) => {
      (acc[info.network_id] ??= []).push(info);
      return acc;
    }, {} as Record<string, IAccountAddressInfo[]>),
  );

  sameNetworkInfos.forEach(([network_id, infos]) => {
    adjacencyList[serializeNetworkIdNode(network_id)] = Object.fromEntries(
      infos.map((info) => [
        serializeAddressNode(network_id, info.address),
        mapNetworkIdToNetworkInfo[
          JSON.stringify({
            namespace: 'network',
            key: network_id,
          })
        ]?.commission ?? 0 / 2,
      ]),
    );
    for (const info of infos) {
      (adjacencyList[serializeAddressNode(network_id, info.address)] ??= {})[
        serializeNetworkIdNode(network_id)
      ] = 0;
    }
  });

  try {
    const path: string[] = dijkstra.find_path(
      adjacencyList,
      serializeAccountIdNode(credit_account_id),
      serializeAccountIdNode(debit_account_id),
    );
    const result = path.map(extractKey);
    return slidingWithStep(result, 5, 4).map(
      ([tx_account_id, tx_address, network_id, rx_address, rx_account_id]): ITransferPair => ({
        tx_account_id,
        tx_address,
        network_id,
        rx_address,
        rx_account_id,
      }),
    );
  } catch (e) {
    return undefined;
  }
};

const wrapTransferRoutingCache = (origin: ITransferRoutingCache): IDataRecord<ITransferRoutingCache> => ({
  id: `${origin.credit_account_id}-${origin.debit_account_id}`,
  type: 'transfer_routing_cache',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    credit_account_id: origin.credit_account_id,
    debit_account_id: origin.debit_account_id,
  },
  origin,
});

const updateTransferOrder = (order: ITransferOrder): Observable<void> =>
  terminal
    .updateDataRecords([
      {
        id: order.order_id,
        type: 'transfer_order',
        created_at: order.created_at,
        updated_at: order.updated_at,
        frozen_at: null,
        tags: {
          debit_account_id: order.debit_account_id,
          credit_account_id: order.credit_account_id,
          status: `${order.status}`,
        },
        origin: order,
      },
    ])
    .pipe(concatWith(of(void 0)));

const iterateTransferOrder = (order: ITransferOrder): ITransferOrder => {
  const { routing_path, current_routing_index } = order;
  // iterate 5-tuple

  // init case
  if (current_routing_index === undefined) {
    return {
      ...order,
      current_amount: order.expected_amount,
      current_routing_index: 0,
      current_tx_state: 'INIT',
      current_rx_state: 'INIT',
      current_tx_account_id: routing_path![0].tx_account_id,
      current_tx_address: routing_path![0].tx_address,
      current_network_id: routing_path![0].network_id,
      current_rx_address: routing_path![0].rx_address,
      current_rx_account_id: routing_path![0].rx_account_id,
    };
  }
  // current_tx_state must be COMPLETE
  if (current_routing_index === routing_path!.length - 1) {
    return {
      ...order,
      status: 'COMPLETE',
    };
  }

  if (current_routing_index < 0 || current_routing_index >= routing_path!.length - 1) {
    return {
      ...order,
      error_message: `Invalid Current Tx Account ID: ${current_routing_index}`,
      status: 'ERROR',
    };
  }

  const next_routing_index = current_routing_index + 1;

  return {
    ...order,
    current_routing_index: next_routing_index,
    current_tx_state: 'INIT',
    current_rx_state: 'INIT',
    current_tx_account_id: routing_path![next_routing_index].tx_account_id,
    current_tx_address: routing_path![next_routing_index].tx_address,
    current_network_id: routing_path![next_routing_index].network_id,
    current_rx_address: routing_path![next_routing_index].rx_address,
    current_rx_account_id: routing_path![next_routing_index].rx_account_id,
  };
};

const processTransfer = (order: ITransferOrder): Observable<void> => {
  return new Observable((subscriber) => {
    const subs: Subscription[] = [];
    const routing_path$ = defer(async () => {
      let routing_path =
        order.routing_path ||
        (await firstValueFrom(
          terminal
            .queryDataRecords<ITransferRoutingCache>({
              type: 'transfer_routing_cache',
              tags: {
                credit_account_id: order.credit_account_id,
                debit_account_id: order.debit_account_id,
              },
            })
            .pipe(
              //
              map((v) => v.origin.routing_path),
              defaultIfEmpty(undefined),
            ),
        ));
      if (!routing_path) {
        routing_path = await makeRoutingPath(order);
        if (routing_path !== undefined) {
          await firstValueFrom(
            terminal
              .updateDataRecords([
                wrapTransferRoutingCache({
                  credit_account_id: order.credit_account_id,
                  debit_account_id: order.debit_account_id,
                  routing_path,
                }),
              ])
              .pipe(concatWith(of(void 0))),
          );
        }
      }
      console.info(
        formatTime(Date.now()),
        `RoutingPath`,
        order.order_id,
        order.credit_account_id,
        order.debit_account_id,
        routing_path,
      );
      return routing_path;
    }).pipe(
      //
      tap((v) => {
        if (!order.routing_path) {
          console.info(
            formatTime(Date.now()),
            'NewRoutingPath',
            order.order_id,
            order.credit_account_id,
            order.debit_account_id,
            v,
          );
        }
      }),
      shareReplay(1),
    );

    let onGoingOrder: ITransferOrder = { ...order };

    const transferStart$ = new Subject<void>();
    const transferIteratePair$ = new Subject<void>();
    const transferApply$ = new Subject<void>();
    const transferEval$ = new Subject<void>();
    const transferComplete$ = new Subject<void>();
    const transferError$ = new Subject<void>();

    // the first step, to get or calculate the routing path
    subs.push(
      routing_path$
        .pipe(
          //
          delayWhen((path) => {
            const nextOrder = {
              ...onGoingOrder,
              routing_path: path,
              status: path !== undefined ? 'ONGOING' : 'ERROR',
              error_message: path === undefined ? 'Cannot find a routing path' : undefined,
            };
            onGoingOrder = nextOrder;
            return updateTransferOrder(onGoingOrder);
          }),
        )
        .subscribe((path) => {
          if (path !== undefined) {
            transferStart$.next();
          } else {
            transferError$.next();
          }
        }),
    );

    subs.push(
      transferStart$.subscribe(() => {
        console.info(formatTime(Date.now()), 'TransferStart', onGoingOrder.order_id);
      }),
    );

    subs.push(
      transferStart$.subscribe(() => {
        if (
          // initial case
          onGoingOrder.current_tx_state === undefined ||
          // restore state case, e.g. restart the service in the middle
          (onGoingOrder.current_tx_state === 'COMPLETE' && onGoingOrder.current_rx_state === 'COMPLETE')
        ) {
          transferIteratePair$.next();
        } else if (onGoingOrder.current_tx_state !== 'COMPLETE') {
          transferApply$.next();
        } else {
          transferEval$.next();
        }
      }),
    );

    subs.push(
      transferIteratePair$.subscribe(() => {
        console.info(formatTime(Date.now()), 'TransferIteratePair', onGoingOrder.order_id);
      }),
    );

    // Iterate the routing path, find the next pair of tx and rx, or mark as completed
    subs.push(
      transferIteratePair$
        .pipe(
          //
          delayWhen(() => {
            const nextOrder = iterateTransferOrder(onGoingOrder);
            onGoingOrder = nextOrder;
            return updateTransferOrder(onGoingOrder);
          }),
        )
        .subscribe(() => {
          if (onGoingOrder.status === 'COMPLETE') {
            transferComplete$.next();
          } else if (onGoingOrder.status === 'ERROR') {
            transferError$.next();
          } else if (onGoingOrder.current_tx_state === 'COMPLETE') {
            transferEval$.next();
          } else {
            transferApply$.next();
          }
        }),
    );

    subs.push(
      transferApply$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferApply',
          onGoingOrder.order_id,
          `current step: ${onGoingOrder.current_tx_account_id}->${onGoingOrder.current_rx_account_id}`,
        );
      }),
    );

    // Apply the Transfer step, retry if needed, transit to Eval if success
    subs.push(
      transferApply$
        .pipe(
          //
          mergeMap(() =>
            terminal.requestService('TransferApply', onGoingOrder).pipe(
              tap((v) => {
                console.info(formatTime(Date.now()), 'TransferEvalResponse', v);
              }),
              delayWhen((v) => {
                const nextOrder: ITransferOrder = {
                  ...onGoingOrder,
                  error_message: v.res?.code !== 0 ? v.res?.message || '' : undefined,
                  status: v.res?.data?.state === 'ERROR' ? 'ERROR' : 'ONGOING',
                  current_transaction_id: v.res?.data?.transaction_id,
                  current_tx_state: v.res?.data?.state,
                  current_tx_context: v.res?.data?.context,
                };
                onGoingOrder = nextOrder;
                return updateTransferOrder(onGoingOrder);
              }),
              map((v) => {
                if (v.res?.data?.state === 'COMPLETE') {
                  return 'COMPLETE';
                }
                if (v.res?.data?.state === 'ERROR') {
                  return 'ERROR';
                }
                return 'RETRY';
              }),
              catchError((e) => {
                console.error(formatTime(Date.now()), 'TransferApplyError', e);
                const nextOrder: ITransferOrder = {
                  ...onGoingOrder,
                  error_message: `${e}`,
                  status: 'ERROR',
                };
                onGoingOrder = nextOrder;
                return updateTransferOrder(onGoingOrder).pipe(map(() => 'ERROR'));
              }),
            ),
          ),
        )
        .subscribe((state: string) => {
          if (state === 'COMPLETE') {
            transferEval$.next();
          } else if (state === 'ERROR') {
            transferError$.next();
          } else {
            timer(1000).subscribe(() => {
              transferApply$.next();
            });
          }
        }),
    );

    subs.push(
      transferEval$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferEval',
          onGoingOrder.order_id,
          `current step: ${onGoingOrder.current_tx_account_id}->${onGoingOrder.current_rx_account_id}`,
        );
      }),
    );

    // Eval the Transfer step, retry if needed, transit to next iteration if success
    subs.push(
      transferEval$
        .pipe(
          //
          mergeMap(() =>
            terminal.requestService('TransferEval', onGoingOrder).pipe(
              //
              tap((v) => {
                console.info(formatTime(Date.now()), 'TransferEvalResponse', v);
              }),
              delayWhen((v) => {
                const nextOrder: ITransferOrder = {
                  ...onGoingOrder,
                  error_message: v.res?.code !== 0 ? v.res?.message || '' : undefined,
                  status: v.res?.data?.state === 'ERROR' ? 'ERROR' : 'ONGOING',
                  current_rx_state: v.res?.data?.state,
                  current_rx_context: v.res?.data?.context,
                  current_amount: v.res?.data?.received_amount ?? onGoingOrder.current_amount, // Ensure the amount available (not empty), change it only if new received_amount coming
                };
                onGoingOrder = nextOrder;
                return updateTransferOrder(onGoingOrder);
              }),
              map((v) => {
                if (v.res?.data?.state === 'COMPLETE') {
                  return 'COMPLETE';
                }
                if (v.res?.data?.state === 'ERROR') {
                  return 'ERROR';
                }
                return 'RETRY';
              }),
              catchError((e) => {
                console.error(formatTime(Date.now()), 'TransferEvalError', e);
                const nextOrder: ITransferOrder = {
                  ...onGoingOrder,
                  error_message: `${e}`,
                  status: 'ERROR',
                };
                onGoingOrder = nextOrder;
                return updateTransferOrder(onGoingOrder).pipe(map(() => 'ERROR'));
              }),
            ),
          ),
        )
        .subscribe((state: string) => {
          if (state === 'COMPLETE') {
            transferIteratePair$.next();
          } else if (state === 'ERROR') {
            transferError$.next();
          } else {
            timer(1000).subscribe(() => {
              transferEval$.next();
            });
          }
        }),
    );

    subs.push(
      transferError$.subscribe(() => {
        console.error(formatTime(Date.now()), 'TransferError', onGoingOrder.order_id);
      }),
    );

    subs.push(
      transferComplete$.subscribe(() => {
        console.info(formatTime(Date.now()), 'TransferComplete', onGoingOrder.order_id);
      }),
    );

    return () => {
      for (const sub of subs) {
        sub.unsubscribe();
      }
    };
  });
};
