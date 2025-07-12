import { PromRegistry } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escape, requestSQL } from '@yuants/sql';
import {
  IAccountAddressInfo,
  ITransferNetworkInfo,
  ITransferOrder,
  ITransferPair,
  ITransferRoutingCache,
  transferApply,
  transferEval,
} from '@yuants/transfer';
import { encodePath, formatTime } from '@yuants/utils';
// @ts-ignore
import dijkstra from 'dijkstrajs';
import {
  Observable,
  catchError,
  defaultIfEmpty,
  defer,
  firstValueFrom,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import './migration';
import { terminal } from './terminal';

defer(() =>
  requestSQL<ITransferOrder[]>(
    terminal,
    `SELECT * FROM transfer_order WHERE status NOT IN ('ERROR', 'COMPLETE')`,
  ),
)
  .pipe(
    //
    retry({ delay: 1_000 }),
    mergeMap((v) =>
      from(v).pipe(
        //
        mergeMap((order) =>
          dispatchTransfer(order).pipe(
            catchError((e) => {
              console.error(formatTime(Date.now()), 'TransferDispatchError', order.order_id, e);
              return of(void 0);
            }),
          ),
        ),
      ),
    ),
    repeat({ delay: 1_000 }),
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
    defer(() => requestSQL<IAccountAddressInfo[]>(terminal, `SELECT * FROM account_address_info`)),
  );

  const transferNetworkInfoList = await firstValueFrom(
    defer(() => requestSQL<ITransferNetworkInfo[]>(terminal, `SELECT * FROM transfer_network_info`)).pipe(
      //
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
    console.error(
      formatTime(Date.now()),
      'FindRoutingPathError',
      e,
      adjacencyList,
      serializeAccountIdNode(credit_account_id),
      serializeAccountIdNode(debit_account_id),
    );
    return undefined;
  }
};

const updateTransferOrder = (order: ITransferOrder): Promise<void> => {
  return requestSQL(
    terminal,
    buildInsertManyIntoTableSQL([order], 'transfer_order', {
      conflictKeys: ['order_id'],
    }),
  );
};

const iterateTransferOrder = (order: ITransferOrder): ITransferOrder => {
  const { routing_path, current_routing_index } = order;
  // iterate 5-tuple

  // init case
  if (current_routing_index === null || current_routing_index === undefined) {
    return {
      ...order,
      updated_at: formatTime(Date.now()),
      current_amount: order.expected_amount,
      current_routing_index: 0,
      current_tx_state: 'INIT',
      current_rx_state: 'INIT',
      current_tx_account_id: routing_path![0].tx_account_id,
      current_tx_address: routing_path![0].tx_address,
      current_network_id: routing_path![0].network_id,
      current_rx_address: routing_path![0].rx_address,
      current_rx_account_id: routing_path![0].rx_account_id,
      current_step_started_at: formatTime(Date.now()),
    };
  }
  // current_tx_state must be COMPLETE
  // COMPLETE case
  if (current_routing_index === routing_path!.length - 1) {
    return {
      ...order,
      updated_at: formatTime(Date.now()),
      status: 'COMPLETE',
    };
  }

  if (current_routing_index < 0 || current_routing_index >= routing_path!.length - 1) {
    return {
      ...order,
      updated_at: formatTime(Date.now()),
      error_message: `Invalid Current Tx Account ID: ${current_routing_index}`,
      status: 'ERROR',
    };
  }

  const next_routing_index = current_routing_index + 1;

  return {
    ...order,
    updated_at: formatTime(Date.now()),
    current_routing_index: next_routing_index,
    current_tx_state: 'INIT',
    current_rx_state: 'INIT',
    current_tx_account_id: routing_path![next_routing_index].tx_account_id,
    current_tx_address: routing_path![next_routing_index].tx_address,
    current_network_id: routing_path![next_routing_index].network_id,
    current_rx_address: routing_path![next_routing_index].rx_address,
    current_rx_account_id: routing_path![next_routing_index].rx_account_id,
    current_step_started_at: formatTime(Date.now()),
  };
};

const dispatchTransfer = (order: ITransferOrder): Observable<void> => {
  return defer(async () => {
    console.info(formatTime(Date.now()), 'TransferDispatch', order.order_id, JSON.stringify(order));
    // if routing path is not defined, retrieve or calculate one
    if (order.routing_path === null || order.routing_path === undefined) {
      const cache = await firstValueFrom(
        defer(() =>
          requestSQL<ITransferRoutingCache[]>(
            terminal,
            `SELECT * FROM transfer_routing_cache WHERE credit_account_id = ${escape(
              order.credit_account_id,
            )} AND debit_account_id = ${escape(order.debit_account_id)}`,
          ),
        ).pipe(
          //
          mergeMap((v) => v),
          map((v) => v.routing_path),
          defaultIfEmpty(undefined),
        ),
      );

      let path = cache;

      if (cache === null || cache === undefined) {
        const routing_path = await makeRoutingPath(order);
        if (routing_path !== null && routing_path !== undefined) {
          console.info(
            formatTime(Date.now()),
            `NewRoutingPath`,
            order.order_id,
            order.credit_account_id,
            order.debit_account_id,
            path,
          );
          await firstValueFrom(
            defer(() =>
              requestSQL(
                terminal,
                buildInsertManyIntoTableSQL(
                  [
                    {
                      credit_account_id: order.credit_account_id,
                      debit_account_id: order.debit_account_id,
                      routing_path,
                    },
                  ],
                  'transfer_routing_cache',
                  {
                    ignoreConflict: true,
                  },
                ),
              ),
            ),
          );
          path = routing_path;
        }
      }

      console.info(
        formatTime(Date.now()),
        `RoutingPath`,
        order.order_id,
        order.credit_account_id,
        order.debit_account_id,
        path,
      );

      const nextOrder: ITransferOrder = {
        ...order,
        updated_at: formatTime(Date.now()),
        routing_path: path,
        status: path !== null && path !== undefined ? 'ONGOING' : 'ERROR',
        error_message: path === null || path === undefined ? 'Cannot find a routing path' : undefined,
      };
      return updateTransferOrder(nextOrder);
    }

    // routing path is defined, check if current transfer is timed out
    if (order.current_network_id !== null && order.current_network_id !== undefined) {
      const networkInfo = await firstValueFrom(
        defer(() =>
          requestSQL<ITransferNetworkInfo[]>(
            terminal,
            `SELECT * FROM transfer_network_info WHERE network_id = ${escape(order.current_network_id)};`,
          ),
        ).pipe(
          //
          mergeMap((x) => x),
          defaultIfEmpty(undefined),
        ),
      );
      const timeout = networkInfo?.timeout ?? 300_000;
      if (
        order.current_step_started_at !== null &&
        order.current_step_started_at !== undefined &&
        Date.now() - new Date(order.current_step_started_at).getTime() > timeout
      ) {
        console.error(
          formatTime(Date.now()),
          'TransferTimeout',
          order.order_id,
          `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
        );
        return updateTransferOrder({
          ...order,
          updated_at: formatTime(Date.now()),
          status: 'ERROR',
          error_message: `Timeout: ${timeout}ms exceeded for ${order.current_tx_account_id}->${order.current_rx_account_id}`,
        });
      }
    }

    // iterate the transfer order
    if (
      // initial case
      ((order.current_tx_state === null || order.current_tx_state === undefined) &&
        (order.current_rx_state === null || order.current_rx_state === undefined)) ||
      // restore state case, e.g. restart the service in the middle
      (order.current_tx_state === 'COMPLETE' && order.current_rx_state === 'COMPLETE')
    ) {
      const nextOrder = iterateTransferOrder(order);
      console.info(
        formatTime(Date.now()),
        'TransferIteratePair',
        order.order_id,
        `current step: ${nextOrder.current_tx_account_id}->${nextOrder.current_rx_account_id}`,
      );
      return updateTransferOrder(nextOrder);
    }

    // apply
    if (order.current_tx_state !== 'COMPLETE') {
      console.info(
        formatTime(Date.now()),
        'TransferApply',
        order.order_id,
        `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
      );
      const applyResult = await transferApply(terminal, order);

      console.info(formatTime(Date.now()), 'TransferApplyResponse', applyResult);

      const nextOrder: ITransferOrder = {
        ...order,
        updated_at: formatTime(Date.now()),
        error_message: applyResult.data?.message,
        status: applyResult.data?.state === 'ERROR' ? 'ERROR' : 'ONGOING',
        current_transaction_id: applyResult.data?.transaction_id,
        current_tx_state: applyResult.data?.state || order.current_tx_state,
        current_tx_context: applyResult.data?.context,
      };

      if (
        order.error_message === nextOrder.error_message &&
        order.status === nextOrder.status &&
        order.current_tx_state === nextOrder.current_tx_state &&
        order.current_tx_context === nextOrder.current_tx_context &&
        order.current_transaction_id === nextOrder.current_transaction_id
      ) {
        console.info(
          formatTime(Date.now()),
          'TransferApply',
          order.order_id,
          'No change in the order',
          `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
        );
        return;
      }
      console.info(
        formatTime(Date.now()),
        'TransferUpdate',
        order.order_id,
        JSON.stringify(order),
        `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
      );
      return updateTransferOrder(nextOrder);
    }

    // eval
    if (order.current_rx_state !== 'COMPLETE') {
      console.info(
        formatTime(Date.now()),
        'TransferEval',
        order.order_id,
        `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
      );

      const evalResult = await transferEval(terminal, order);
      console.info(formatTime(Date.now()), 'TransferEvalResponse', evalResult);

      const nextOrder: ITransferOrder = {
        ...order,
        updated_at: formatTime(Date.now()),
        error_message: evalResult?.message,
        status: evalResult?.data?.state === 'ERROR' ? 'ERROR' : 'ONGOING',
        current_rx_state: evalResult?.data?.state,
        current_rx_context: evalResult?.data?.context,
        current_amount: evalResult?.data?.received_amount ?? order.current_amount, // Ensure the amount available (not empty), change it only if new received_amount coming
      };

      if (
        order.error_message === nextOrder.error_message &&
        order.status === nextOrder.status &&
        order.current_rx_state === nextOrder.current_rx_state &&
        order.current_rx_context === nextOrder.current_rx_context &&
        order.current_amount === nextOrder.current_amount
      ) {
        console.info(
          formatTime(Date.now()),
          'TransferEval',
          order.order_id,
          'No change in the order',
          `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
        );
        return;
      }

      console.info(
        formatTime(Date.now()),
        'TransferUpdate',
        order.order_id,
        JSON.stringify(order),
        `current step: ${order.current_tx_account_id}->${order.current_rx_account_id}`,
      );
      return updateTransferOrder(nextOrder);
    }
  });
};

const MetricFailedTransferOrders = PromRegistry.create(
  'gauge',
  'failed_transfer_orders',
  'Failed Transfer Orders',
);

// check if there's any failed transfer order
defer(() => requestSQL<ITransferOrder[]>(terminal, `SELECT * FROM transfer_order WHERE status = 'ERROR'`))
  .pipe(
    repeat({ delay: 10_000 }),
    retry({ delay: 5000 }),
    tap(() => {
      // ISSUE: reset the metric before fetching new records,
      // otherwise the metric will not be updated correctly
      MetricFailedTransferOrders.resetAll();
    }),
    mergeMap((records) =>
      from(records).pipe(
        groupBy((record) => `${record.debit_account_id}-${record.credit_account_id}`),
        mergeMap((group) =>
          group.pipe(
            //
            toArray(),
            tap((v) => {
              MetricFailedTransferOrders.set(v.length, {
                debit_account_id: v[0].debit_account_id,
                credit_account_id: v[0].credit_account_id,
              });
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();
