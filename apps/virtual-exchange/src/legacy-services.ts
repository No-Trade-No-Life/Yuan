import { provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { cancelOrder, getOrders, getPositions, modifyOrder, submitOrder } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { listWatch, newError } from '@yuants/utils';
import { map, Observable } from 'rxjs';
import { validCredentials$ } from './credential';
import { polyfillOrders, polyfillPosition } from './position';

const terminal = Terminal.fromNodeEnv();

validCredentials$
  .pipe(
    map((x) => Array.from(x.entries())),
    listWatch(
      ([id]) => id,
      ([credential_id, credential]) =>
        new Observable((sub) => {
          console.info(`Setting up VEX services for credential: ${credential_id}`);
          // Setup AccountInfo Service
          {
            const service = provideAccountInfoService(
              terminal,
              credential_id,
              async () => {
                const res = await getPositions(terminal, credential);
                if (!res.data) throw newError('FETCH_POSITIONS_FAILED', { credential_id, res });
                const polyfilledPositions = await polyfillPosition(res.data);
                polyfilledPositions.forEach((pos) => {
                  pos.account_id = credential_id;
                });
                return polyfilledPositions;
              },
              {
                auto_refresh_interval: 1000,
              },
            );
            sub.add(() => {
              service.dispose$.next();
            });
          }
          // Setup Pending Orders Service
          {
            const service = providePendingOrdersService(
              terminal,
              credential_id,
              async () => {
                const res = await getOrders(terminal, credential);
                if (!res.data) throw newError('FETCH_ORDERS_FAILED', { credential_id, res });

                res.data.forEach((order) => {
                  order.account_id = credential_id;
                });

                await polyfillOrders(res.data);

                return res.data;
              },
              {
                auto_refresh_interval: 10000,
              },
            );
            sub.add(() => {
              service.dispose$.next();
            });
          }
          // Setup SubmitOrder Service
          {
            const service = terminal.server.provideService<IOrder, { order_id: string }>(
              'SubmitOrder',
              {
                type: 'object',
                required: ['account_id'],
                properties: {
                  account_id: { type: 'string', const: credential_id },
                },
              },
              async (msg) => {
                const [order] = await polyfillOrders([msg.req]);
                const res = await submitOrder(terminal, credential, order);
                return { res };
              },
            );
            sub.add(() => {
              service.dispose();
            });
          }

          // Setup ModifyOrder Service
          {
            const service = terminal.server.provideService<IOrder, void>(
              'ModifyOrder',
              {
                type: 'object',
                required: ['account_id'],
                properties: {
                  account_id: { type: 'string', const: credential_id },
                },
              },
              async (msg) => {
                const [order] = await polyfillOrders([msg.req]);
                const res = await modifyOrder(terminal, credential, order);
                return { res };
              },
            );
            sub.add(() => {
              service.dispose();
            });
          }

          // Setup CancelOrder Service
          {
            const service = terminal.server.provideService<IOrder, void>(
              'CancelOrder',
              {
                type: 'object',
                required: ['account_id'],
                properties: {
                  account_id: { type: 'string', const: credential_id },
                },
              },
              async (msg) => {
                const [order] = await polyfillOrders([msg.req]);
                const res = await cancelOrder(terminal, credential, order);
                return { res };
              },
            );
            sub.add(() => {
              service.dispose();
            });
          }
        }),
    ),
  )
  .subscribe();
