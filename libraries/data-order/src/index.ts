import { createCache } from '@yuants/cache';
import { Terminal } from '@yuants/protocol';
import { ObservableInput, Subject, defer, retry, takeUntil, tap, timeout } from 'rxjs';
import './interface';
import { IOrder } from './interface';
export * from './interface';

/**
 * Provide a PendingOrders service, which can be queried and auto-updated
 * @public
 */
export const providePendingOrdersService = (
  terminal: Terminal,
  account_id: string,
  query: () => Promise<IOrder[]>,
  options?: {
    auto_refresh_interval?: number;
  },
) => {
  const dispose$ = new Subject<void>();
  const pendingOrders$ = new Subject<IOrder[]>();
  const cache = createCache<IOrder[]>(
    async () => {
      const data = await query();
      // 立即推送最新的数据
      return data;
    },
    {
      writeLocal: async (_key: string, data: IOrder[]) => {
        pendingOrders$.next(data);
      },
    },
  );

  const disposable0 = terminal.server.provideService<
    {
      account_id: string;
      force_update?: boolean;
    },
    IOrder[]
  >(
    'QueryPendingOrders',
    {
      type: 'object',
      required: ['account_id'],
      properties: {
        account_id: { type: 'string', const: account_id },
        force_update: { type: 'boolean' },
      },
    },
    async ({ req }) => {
      return { res: { code: 0, message: 'OK', data: await cache.query('', req.force_update) } };
    },
  );

  dispose$.subscribe(() => {
    disposable0.dispose();
  });

  const disposable1 = terminal.channel.publishChannel(
    'PendingOrders',
    { const: account_id },
    () => pendingOrders$,
  );

  dispose$.subscribe(() => {
    disposable1.dispose();
  });

  const { auto_refresh_interval } = options || {};

  if (auto_refresh_interval) {
    const triggerRefresh = () => {
      terminal.client
        .requestForResponseData<{ account_id: string; force_update: boolean }, IOrder[]>(
          'QueryPendingOrders',
          {
            account_id,
            force_update: true,
          },
        )
        .catch(() => {});
    };

    // 当 pendingOrders$ 超时没有数据时，自动拉取一次
    defer(() => pendingOrders$)
      .pipe(
        timeout(auto_refresh_interval),
        tap({
          error: triggerRefresh,
        }),
        retry(),
        takeUntil(dispose$),
      )
      .subscribe();
  }

  return {
    dispose$,
  };
};

/**
 * use pending orders data stream
 * @public
 */
export const usePendingOrders = (terminal: Terminal, account_id: string) =>
  terminal.channel.subscribeChannel<IOrder[]>('PendingOrders', account_id);

/**
 * Query pending orders once
 * @public
 */
export const queryPendingOrders = async (terminal: Terminal, account_id: string, force_update?: boolean) =>
  terminal.client.requestForResponseData<{ account_id: string; force_update?: boolean }, IOrder[]>(
    'QueryPendingOrders',
    {
      account_id,
      force_update,
    },
  );
