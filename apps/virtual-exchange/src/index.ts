import { IAccountInfo } from '@yuants/data-account';
import { IOrder, ITypedCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ISecret, readSecret, writeSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { defer, mergeMap, retry, timer } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

interface IExchangeCredential {
  type: string;
  payload: any;
}

const mapAccountIdToCredential = new Map<string, IExchangeCredential>();

// 1. RegisterExchangeCredential
terminal.server.provideService<IExchangeCredential, void>(
  'RegisterExchangeCredential',
  {
    type: 'object',
    required: ['type', 'payload'],
    properties: {
      type: { type: 'string' },
      payload: { type: 'object' },
    },
  },
  async (msg) => {
    const credential = msg.req;
    const secretData = new TextEncoder().encode(JSON.stringify(credential));
    await writeSecret(terminal, terminal.keyPair.public_key, { type: 'exchange_credential' }, secretData);
    return { res: { code: 0, message: 'OK' } };
  },
);

// 2. ListExchangeCredential
terminal.server.provideService<void, IExchangeCredential[]>('ListExchangeCredential', {}, async () => {
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      terminal.keyPair.public_key,
    )}`,
  );
  const credentials: IExchangeCredential[] = [];
  for (const secret of secrets) {
    try {
      const decrypted = await readSecret(terminal, secret);
      const credential = JSON.parse(new TextDecoder().decode(decrypted));
      credentials.push(credential);
    } catch (e) {
      console.error('Failed to decrypt secret', e);
    }
  }
  return { res: { code: 0, message: 'OK', data: credentials } };
});

// 9. Background listWatch
const updateIndex = async () => {
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      terminal.keyPair.public_key,
    )}`,
  );
  for (const secret of secrets) {
    try {
      const decrypted = await readSecret(terminal, secret);
      const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;

      // Call ListAccounts to get account_ids
      const res = await terminal.client.requestForResponse<
        { credential: ITypedCredential<any> },
        Array<{ account_id: string }>
      >('ListAccounts', { credential });

      if (res.code === 0 && res.data) {
        for (const account of res.data) {
          mapAccountIdToCredential.set(account.account_id, credential);
        }
      }
    } catch (e) {
      console.error('Failed to process secret', e);
    }
  }
};

// Run updateIndex periodically
timer(0, 60000)
  .pipe(mergeMap(() => defer(updateIndex).pipe(retry({ delay: 5000 }))))
  .subscribe();

// 7. QueryAccounts
terminal.server.provideService<void, string[]>('QueryAccounts', {}, async () => {
  return { res: { code: 0, message: 'OK', data: Array.from(mapAccountIdToCredential.keys()) } };
});

// 8. QueryAccountInfo
terminal.server.provideService<{ account_id: string }, IAccountInfo>(
  'QueryAccountInfo',
  {
    type: 'object',
    required: ['account_id'],
    properties: {
      account_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapAccountIdToCredential.get(msg.req.account_id);
    if (!credential) {
      return { res: { code: 404, message: 'Account not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; account_id: string },
      IAccountInfo
    >('GetAccountInfo', { credential, account_id: msg.req.account_id });
    return { res };
  },
);

// 10. Proxy Orders
// SubmitOrder
terminal.server.provideService<{ order: IOrder }, { order_id: string }>(
  'SubmitOrder',
  {
    type: 'object',
    required: ['order'],
    properties: {
      order: { type: 'object' },
    },
  },
  async (msg) => {
    const credential = mapAccountIdToCredential.get(msg.req.order.account_id);
    if (!credential) {
      return { res: { code: 404, message: 'Account not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      { order_id: string }
    >('SubmitOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// ModifyOrder
terminal.server.provideService<{ order: IOrder }, void>(
  'ModifyOrder',
  {
    type: 'object',
    required: ['order'],
    properties: {
      order: { type: 'object' },
    },
  },
  async (msg) => {
    const credential = mapAccountIdToCredential.get(msg.req.order.account_id);
    if (!credential) {
      return { res: { code: 404, message: 'Account not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      void
    >('ModifyOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// CancelOrder
terminal.server.provideService<{ order: IOrder }, void>(
  'CancelOrder',
  {
    type: 'object',
    required: ['order'],
    properties: {
      order: { type: 'object' },
    },
  },
  async (msg) => {
    const credential = mapAccountIdToCredential.get(msg.req.order.account_id);
    if (!credential) {
      return { res: { code: 404, message: 'Account not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      void
    >('CancelOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// ListOrders
terminal.server.provideService<{ account_id: string }, { orders: IOrder[] }>(
  'ListOrders',
  {
    type: 'object',
    required: ['account_id'],
    properties: {
      account_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapAccountIdToCredential.get(msg.req.account_id);
    if (!credential) {
      return { res: { code: 404, message: 'Account not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; account_id: string },
      { orders: IOrder[] }
    >('ListOrders', {
      credential,
      account_id: msg.req.account_id,
    });
    return { res };
  },
);
