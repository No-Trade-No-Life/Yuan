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

const mapCredentialIdToCredential = new Map<string, IExchangeCredential>();

// 1. RegisterExchangeCredential
terminal.server.provideService<IExchangeCredential, void>(
  'VirtualExchange/RegisterExchangeCredential',
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
terminal.server.provideService<void, IExchangeCredential[]>(
  'VirtualExchange/ListExchangeCredential',
  {},
  async () => {
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
  },
);

terminal.server.provideService<void, string[]>('VirtualExchange/ListCredentials', {}, async () => {
  return { res: { code: 0, message: 'OK', data: [...mapCredentialIdToCredential.keys()] } };
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

      // Call GetCredentialId to get credential id
      const res = await terminal.client.requestForResponse<{ credential: ITypedCredential<any> }, string>(
        'GetCredentialId',
        { credential },
      );

      if (res.code === 0 && res.data) {
        const credentialId = res.data;
        mapCredentialIdToCredential.set(credentialId, credential);
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

// 8. QueryAccountInfo
terminal.server.provideService<{ credential_id: string; product_id?: string }, IAccountInfo>(
  'VirtualExchange/QueryPositions',
  {
    type: 'object',
    required: ['credential_id'],
    properties: {
      credential_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapCredentialIdToCredential.get(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; product_id?: string },
      IAccountInfo
    >('QueryPositions', { credential, product_id: msg.req.product_id });
    return { res };
  },
);

terminal.server.provideService<{ credential_id: string; product_id?: string }, { orders: IOrder[] }>(
  'VirtualExchange/QueryOrders',
  {
    type: 'object',
    required: ['credential_id'],
    properties: {
      credential_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapCredentialIdToCredential.get(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; product_id?: string },
      { orders: IOrder[] }
    >('QueryOrders', {
      credential,
      product_id: msg.req.product_id,
    });
    return { res };
  },
);

// 10. Proxy Orders
// SubmitOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, { order_id: string }>(
  'VirtualExchange/SubmitOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapCredentialIdToCredential.get(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      { order_id: string }
    >('SubmitOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// ModifyOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, void>(
  'VirtualExchange/ModifyOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapCredentialIdToCredential.get(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      void
    >('ModifyOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// CancelOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, void>(
  'VirtualExchange/CancelOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = mapCredentialIdToCredential.get(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await terminal.client.requestForResponse<
      { credential: ITypedCredential<any>; order: IOrder },
      void
    >('CancelOrder', { credential, order: msg.req.order });
    return { res };
  },
);

// ListOrders
