import { IAccountAddressInfo, ITransferOrder, wrapAccountAddressInfo } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { Subject, debounceTime, defer, from, groupBy, mergeMap, tap, toArray } from 'rxjs';

type IAccountTransferAddressContext = IAccountAddressInfo & {
  terminal: Terminal;
  onApply: Record<
    string,
    (order: ITransferOrder) => Promise<{
      state: string;
      context?: string;
      message?: string;
      transaction_id?: string;
    }>
  >;
  onEval: (order: ITransferOrder) => Promise<{
    state: string;
    context?: string;
    received_amount?: number;
  } | void>;
};

const contextList: IAccountTransferAddressContext[] = [];

const update$ = new Subject<void>();

export const addAccountTransferAddress = (ctx: IAccountTransferAddressContext) => {
  contextList.push(ctx);
  update$.next();
};

update$
  .pipe(
    debounceTime(1000),
    mergeMap(() =>
      from(contextList).pipe(
        groupBy((ctx) => ctx.terminal),
        mergeMap((group) =>
          group.pipe(
            toArray(),
            tap((contextList) => {
              //
              const terminal = group.key;
              const accountIdList = [...new Set(contextList.map((ctx) => ctx.account_id))];

              terminal.provideService(
                'TransferApply',
                {
                  type: 'object',
                  required: ['current_tx_account_id'],
                  properties: {
                    current_tx_account_id: {
                      enum: accountIdList,
                    },
                  },
                },
                (msg) =>
                  defer(async () => {
                    const order = msg.req;
                    const ctx = contextList.find(
                      (ctx) =>
                        ctx.account_id === order.current_tx_account_id &&
                        ctx.network_id === order.current_network_id &&
                        ctx.address === order.current_tx_address &&
                        ctx.currency === order.currency,
                    );
                    if (!ctx) {
                      return { res: { code: 400, message: 'Unknown Routing', data: { state: 'ERROR' } } };
                    }
                    const handler = ctx.onApply[order.current_tx_state || 'INIT'];
                    if (!handler) {
                      return { res: { code: 400, message: 'Unknown State', data: { state: 'ERROR' } } };
                    }
                    const res = await handler(order);
                    return { res: { code: 0, message: 'OK', data: res } };
                  }),
              );
              terminal.provideService(
                'TransferEval',
                {
                  type: 'object',
                  required: ['current_rx_account_id'],
                  properties: {
                    current_rx_account_id: {
                      enum: accountIdList,
                    },
                  },
                },
                (msg) =>
                  defer(async () => {
                    const order = msg.req;
                    const ctx = contextList.find(
                      (ctx) =>
                        ctx.account_id === order.current_rx_account_id &&
                        ctx.network_id === order.current_network_id &&
                        ctx.address === order.current_rx_address &&
                        ctx.currency === order.currency,
                    );
                    if (!ctx) {
                      return { res: { code: 400, message: 'Unknown Routing' } };
                    }
                    const res = await ctx.onEval(order);
                    return { res: { code: 0, message: 'OK', data: res } };
                  }),
              );

              terminal
                .updateDataRecords(
                  contextList.map(({ terminal, onApply, onEval, ...info }) => wrapAccountAddressInfo(info)),
                )
                .subscribe();
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();
