import { IDataRecordTypes, ITransferOrder, formatTime, getDataRecordWrapper } from '@yuants/data-model';
import { Terminal, writeDataRecords } from '@yuants/protocol';
import { Subject, debounceTime, defer, from, groupBy, mergeMap, tap, toArray } from 'rxjs';

type IAccountAddressInfo = IDataRecordTypes['account_address_info'];

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
  console.info(
    formatTime(Date.now()),
    'addAccountTransferAddress',
    ctx.account_id,
    ctx.currency,
    ctx.network_id,
    ctx.address,
  );
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

              terminal.provideService(
                'TransferApply',
                {
                  type: 'object',
                  required: ['current_tx_account_id', 'currency', 'current_network_id', 'current_tx_address'],
                  oneOf: contextList.map((x) => ({
                    properties: {
                      current_tx_account_id: {
                        const: x.account_id,
                      },
                      currency: {
                        const: x.currency,
                      },
                      current_network_id: {
                        const: x.network_id,
                      },
                      current_tx_address: {
                        const: x.address,
                      },
                    },
                  })),
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
                    console.info(formatTime(Date.now()), 'TransferApply', JSON.stringify(order));
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
                  required: ['current_rx_account_id', 'currency', 'current_network_id', 'current_rx_address'],
                  oneOf: contextList.map((x) => ({
                    properties: {
                      current_rx_account_id: {
                        const: x.account_id,
                      },
                      currency: {
                        const: x.currency,
                      },
                      current_network_id: {
                        const: x.network_id,
                      },
                      current_rx_address: {
                        const: x.address,
                      },
                    },
                  })),
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
                    console.info(formatTime(Date.now()), 'TransferEval', JSON.stringify(order));
                    const res = await ctx.onEval(order);
                    return { res: { code: 0, message: 'OK', data: res } };
                  }),
              );

              from(
                writeDataRecords(
                  terminal,
                  contextList.map(({ terminal, onApply, onEval, ...info }) =>
                    getDataRecordWrapper('account_address_info')!(info),
                  ),
                ),
              ).subscribe();
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();
