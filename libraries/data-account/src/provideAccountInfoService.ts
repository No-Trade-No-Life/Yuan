import { createCache } from '@yuants/cache';
import { Terminal } from '@yuants/protocol';
import { Subject, defer, retry, takeUntil, tap, timeout } from 'rxjs';
import { IAccountInfo, IPosition } from './interface';
import { publishAccountInfo } from './publishAccountInfo';
import { wrapAccountInfoInput } from './wrap-account-info-input';

/**
 * Provide a AccountInfo service, which can be queried and auto-updated
 * @public
 */
export const provideAccountInfoService = (
  terminal: Terminal,
  account_id: string,
  query: () => Promise<IPosition[]>,
  options?: {
    auto_refresh_interval?: number;
  },
) => {
  const dispose$ = new Subject<void>();
  const accountInfo$ = new Subject<IAccountInfo>();
  const cache = createCache<IAccountInfo>(
    async () => {
      const data = await query();
      return wrapAccountInfoInput(Date.now(), account_id, data);
    },
    {
      writeLocal: async (_, data) => {
        accountInfo$.next(data);
      },
    },
  );

  const disposable0 = terminal.server.provideService<
    {
      account_id: string;
      force_update?: boolean;
    },
    IAccountInfo
  >(
    'QueryAccountInfo',
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

  const disposable1 = publishAccountInfo(terminal, account_id, accountInfo$);

  dispose$.subscribe(() => {
    disposable1.dispose();
  });

  const { auto_refresh_interval } = options || {};

  if (auto_refresh_interval) {
    const triggerRefresh = () => {
      terminal.client
        .requestForResponseData<{ account_id: string; force_update: boolean }, IAccountInfo>(
          'QueryAccountInfo',
          {
            account_id,
            force_update: true,
          },
        )
        .catch(() => {});
    };

    // 当 accountInfo$ 超时没有数据时，自动拉取一次
    defer(() => accountInfo$)
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
