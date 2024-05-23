import {
  IAccountAddressInfo,
  IDataRecord,
  ITransferNetworkInfo,
  ITransferOrder,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';

import '@yuants/protocol/lib/services/transfer';

import { Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import {
  Observable,
  OperatorFunction,
  Subject,
  Subscription,
  concatWith,
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
  toArray,
} from 'rxjs';
// @ts-ignore
import dijkstra from 'dijkstrajs';

interface ITransferRoutingCache {
  credit_account_id: string;
  debit_account_id: string;
  routing_path: string;
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
    filter((order) => order.status !== 'ERROR' && order.status !== 'COMPLETED'),
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

const makeRoutingPath = async (order: ITransferOrder): Promise<string> => {
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
    adjacencyList[account_id] = Object.fromEntries(infos.map((info) => [info.address, 0]));
    for (const info of infos) {
      (adjacencyList[info.address] ??= {})[account_id] = 0;
    }
  });

  const sameNetworkInfos = Object.entries(
    addressInfoList.reduce((acc, info) => {
      (acc[info.network_id] ??= []).push(info);
      return acc;
    }, {} as Record<string, IAccountAddressInfo[]>),
  );

  sameNetworkInfos.forEach(([network_id, infos]) => {
    adjacencyList[network_id] = Object.fromEntries(
      infos.map((info) => [info.address, mapNetworkIdToNetworkInfo[network_id].commission / 2]),
    );
    for (const info of infos) {
      (adjacencyList[info.address] ??= {})[network_id] = 0;
    }
  });

  const result: string[] = dijkstra(adjacencyList, credit_account_id, debit_account_id);
  return encodePath(result);
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
  const { routing_path, current_tx_account_id, current_rx_account_id } = order;
  // iterate 5-tuple
  const route = decodePath(routing_path!);

  if (current_rx_account_id === route[route.length - 1]) {
    return {
      ...order,
      status: 'COMPLETED',
    };
  }

  const current_tx_index =
    current_tx_account_id !== undefined ? route.indexOf(current_tx_account_id) : undefined;

  const [next_tx_account_id, next_tx_address, next_network_id, next_rx_address, next_rx_account_id] =
    current_tx_index !== undefined ? route.slice(current_tx_index, current_tx_index + 5) : route.slice(0, 5);

  return {
    ...order,
    current_tx_account_id: next_tx_account_id,
    current_tx_address: next_tx_address,
    current_network_id: next_network_id,
    current_rx_address: next_rx_address,
    current_rx_account_id: next_rx_account_id,
  };
};

const processTransfer = (order: ITransferOrder): Observable<void> => {
  return new Observable((subscriber) => {
    const subs: Subscription[] = [];

    const routing_path$ = defer(async () => {
      const routing_path =
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
            ),
        ));
      if (!routing_path) {
        const path = await makeRoutingPath(order);
        await firstValueFrom(
          terminal.updateDataRecords([
            wrapTransferRoutingCache({
              credit_account_id: order.credit_account_id,
              debit_account_id: order.debit_account_id,
              routing_path: path,
            }),
          ]),
        );
      }
      return routing_path;
    }).pipe(
      //
      shareReplay(1),
    );

    let onGoingOrder = { ...order };

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
            const nextOrder = { ...onGoingOrder, routing_path: path };
            onGoingOrder = nextOrder;
            return updateTransferOrder(onGoingOrder);
          }),
        )
        .subscribe(() => {
          transferStart$.next();
        }),
    );

    subs.push(
      transferStart$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferStart',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
        );
      }),
    );

    subs.push(
      transferStart$.subscribe(() => {
        transferIteratePair$.next();
      }),
    );

    subs.push(
      transferIteratePair$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferIteratePair',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
        );
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
          if (onGoingOrder.status === 'COMPLETED') {
            transferComplete$.next();
          }
          transferApply$.next();
        }),
    );

    subs.push(
      transferApply$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferApply',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
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
              delayWhen((v) => {
                const nextOrder: ITransferOrder = {
                  ...onGoingOrder,
                  error_message: v.res?.code !== 0 ? v.res?.message || '' : undefined,
                  status: v.res?.data?.state === 'ERROR' ? 'ERROR' : 'ONGOING',
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
            ),
          ),
        )
        .subscribe((state: string) => {
          if (state === 'COMPLETE') {
            transferEval$.next();
          }
          if (state === 'ERROR') {
            transferError$.next();
          }
          transferApply$.next();
        }),
    );

    subs.push(
      transferEval$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferEval',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
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
              map((v) => {
                if (v.res?.code !== 0) {
                  return undefined;
                }
                return v.res.data?.received_amount;
              }),
            ),
          ),
        )
        .subscribe((amount?: number) => {
          if (amount !== undefined) {
            transferIteratePair$.next();
          }
          transferEval$.next();
        }),
    );

    subs.push(
      transferError$.subscribe(() => {
        console.error(
          formatTime(Date.now()),
          'TransferError',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
        );
      }),
    );

    subs.push(
      transferComplete$.subscribe(() => {
        console.info(
          formatTime(Date.now()),
          'TransferComplete',
          onGoingOrder.order_id,
          onGoingOrder.routing_path,
        );
      }),
    );

    subscriber.complete();
    return () => {
      for (const sub of subs) {
        sub.unsubscribe();
      }
    };
  });
};
