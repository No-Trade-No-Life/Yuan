import { IAccountAddressInfo, ITransferNetworkInfo, ITransferOrder } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import {
  Observable,
  OperatorFunction,
  Subscription,
  defer,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  pipe,
  repeat,
  retry,
  shareReplay,
  toArray,
} from 'rxjs';

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

interface IEdge {
  nodeA: IAccountAddressInfo;
  nodeB: IAccountAddressInfo;
  network_info?: ITransferNetworkInfo;
}

const dijkstra = (edges: IEdge[], start: IAccountAddressInfo, end: IAccountAddressInfo) => {
  const nodeHash = (node: IAccountAddressInfo) => `${node.account_id}-${node.network_id}-${node.address}`;
  const adjacencyList = edges.reduce((list, edge) => {
    const { nodeA, nodeB, network_info } = edge;
    list[nodeHash(nodeA)] = list[nodeHash(nodeA)] || [];
    list[nodeHash(nodeB)] = list[nodeHash(nodeB)] || [];
    list[nodeHash(nodeA)].push({ node: nodeB, weight: network_info?.commission || 0 });
    list[nodeHash(nodeB)].push({ node: nodeA, weight: network_info?.commission || 0 });
    return list;
  }, {} as Record<string, { node: IAccountAddressInfo; weight: number }[]>);

  const dist: Record<string, number> = {};
  const prev: Record<string, IAccountAddressInfo | null> = {};

  Object.keys(adjacencyList).forEach((node) => {
    dist[node] = Infinity;
    prev[node] = null;
  });

  dist[nodeHash(start)] = 0;

  const queue: IAccountAddressInfo[] = Object.values(adjacencyList)
    .flat()
    .map(({ node }) => node);

  while (queue.length) {
    queue.sort((a, b) => dist[nodeHash(a)] - dist[nodeHash(b)]);
    const closestNode = queue.shift()!;

    adjacencyList[nodeHash(closestNode)].forEach(({ node, weight }) => {
      const alt = dist[nodeHash(closestNode)] + weight;
      if (alt < dist[nodeHash(node)]) {
        dist[nodeHash(node)] = alt;
        prev[nodeHash(node)] = closestNode;
      }
    });
  }

  const path = [];
  let u: IAccountAddressInfo | null = end;
  while (u) {
    path.unshift(u);
    u = prev[nodeHash(u)];
  }

  return path;
};

const makeRoutingPath = async (order: ITransferOrder): Promise<IAccountAddressInfo[]> => {
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

  const sameAccountInfos = Object.values(
    addressInfoList.reduce((acc, info) => {
      (acc[info.account_id] ??= []).push(info);
      return acc;
    }, {} as Record<string, IAccountAddressInfo[]>),
  );

  const sameAccountEdges = sameAccountInfos.flatMap((infos) => {
    const edges: IEdge[] = [];
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const nodeA = infos[i];
        const nodeB = infos[j];
        edges.push({
          nodeA,
          nodeB,
        });
      }
    }
    return edges;
  });

  const sameNetworkInfos = Object.values(
    addressInfoList.reduce((acc, info) => {
      (acc[info.network_id] ??= []).push(info);
      return acc;
    }, {} as Record<string, IAccountAddressInfo[]>),
  );

  const sameNetworkEdges = sameNetworkInfos.flatMap((infos) => {
    const edges: IEdge[] = [];
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const nodeA = infos[i];
        const nodeB = infos[j];
        const network_info = mapNetworkIdToNetworkInfo[nodeA.network_id];
        edges.push({
          nodeA,
          nodeB,
          network_info,
        });
      }
    }
    return edges;
  });

  const graph = sameAccountEdges.concat(sameNetworkEdges);

  const result = dijkstra(
    graph,
    addressInfoList.find((v) => v.account_id === credit_account_id)!,
    addressInfoList.find((v) => v.account_id === debit_account_id)!,
  );

  return result;
};

const processTransfer = (order: ITransferOrder): Observable<void> => {
  return new Observable((subscriber) => {
    const subs: Subscription[] = [];

    const routing_path = order.routing_path;
    // TODO...

    subscriber.complete();
    return () => {
      for (const sub of subs) {
        sub.unsubscribe();
      }
    };
  });
};
