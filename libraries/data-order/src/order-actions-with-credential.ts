import { IResponse, Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { IOrder } from './interface';

/**
 * Typed wrapped credential interface
 *
 * @public
 */
export interface ITypedCredential<T> {
  type: string;
  payload: T;
}

const makeCredentialSchema = (type: string, payloadSchema: JSONSchema7): JSONSchema7 => {
  return {
    type: 'object',
    required: ['type', 'payload'],
    properties: {
      type: { type: 'string', const: type },
      payload: payloadSchema,
    },
  };
};

/**
 * Provide order action services (submit, modify, cancel) with credentials.
 *
 * @param terminal - The Terminal instance.
 * @param type - For routing the service, e.g. 'BINANCE', 'OKX'.
 * @param credentialSchema - The JSON schema for the credential payload.
 * @param actions - The action implementations.
 * @public
 */
export const provideOrderActionsWithCredential = <T>(
  terminal: Terminal,
  type: string,
  credentialSchema: JSONSchema7,
  actions: {
    submitOrder?: (credential: T, order: IOrder) => Promise<{ order_id: string }>;
    modifyOrder?: (credential: T, order: IOrder) => Promise<void>;
    cancelOrder?: (credential: T, order: IOrder) => Promise<void>;
    listOrders?: (credential: T, account_id: string) => Promise<IOrder[]>;
  },
) => {
  const { submitOrder, modifyOrder, cancelOrder, listOrders } = actions;
  if (submitOrder) {
    terminal.server.provideService<
      {
        order: IOrder;
        credential: ITypedCredential<T>;
      },
      { order_id?: string }
    >(
      'SubmitOrder',
      {
        required: ['order', 'credential'],
        properties: {
          credential: makeCredentialSchema(type, credentialSchema),
        },
      },
      async (msg) => {
        const data = await submitOrder(msg.req.credential.payload, msg.req.order);
        return { res: { code: 0, message: 'OK', data } };
      },
    );
  }

  if (modifyOrder) {
    terminal.server.provideService<{
      order: IOrder;
      credential: ITypedCredential<T>;
    }>(
      'ModifyOrder',
      {
        required: ['order', 'credential'],
        properties: {
          credential: makeCredentialSchema(type, credentialSchema),
        },
      },
      async (msg) => {
        await modifyOrder(msg.req.credential.payload, msg.req.order);
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }

  if (cancelOrder) {
    terminal.server.provideService<{
      order: IOrder;
      credential: ITypedCredential<T>;
    }>(
      'CancelOrder',
      {
        required: ['order', 'credential'],
        properties: {
          credential: makeCredentialSchema(type, credentialSchema),
        },
      },
      async (msg) => {
        await cancelOrder(msg.req.credential.payload, msg.req.order);
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }

  if (listOrders) {
    terminal.server.provideService<
      {
        account_id: string;
        credential: ITypedCredential<T>;
      },
      { orders: IOrder[] }
    >(
      'ListOrders',
      {
        required: ['credential', 'account_id'],
        properties: {
          credential: makeCredentialSchema(type, credentialSchema),
          account_id: { type: 'string' },
        },
      },
      async (msg) => {
        const orders = await listOrders(msg.req.credential.payload, msg.req.account_id);
        return { res: { code: 0, message: 'OK', data: { orders } } };
      },
    );
  }
};

/**
 * Submit an order with credentials.
 * @param terminal - The Terminal instance.
 * @param credential - The credential object.
 * @param order - The order to be submitted.
 * @returns A promise that resolves to the response of the submit order request.
 * @public
 */
export const submitOrder = async <T>(
  terminal: Terminal,
  credential: ITypedCredential<T>,
  order: IOrder,
): Promise<IResponse<{ order_id: string }>> => {
  const res = await terminal.client.requestForResponse<
    {
      order: IOrder;
      credential: ITypedCredential<T>;
    },
    { order_id: string }
  >('SubmitOrder', { credential, order });
  return res;
};

/**
 * Modify an order with credentials.
 * @param terminal - The Terminal instance.
 * @param credential - The credential object.
 * @param order - The order to be modified.
 * @returns A promise that resolves to the response of the modify order request.
 * @public
 */
export const modifyOrder = async <T>(
  terminal: Terminal,
  credential: ITypedCredential<T>,
  order: IOrder,
): Promise<IResponse<void>> => {
  const res = await terminal.client.requestForResponse<
    {
      order: IOrder;
      credential: ITypedCredential<T>;
    },
    void
  >('ModifyOrder', { credential, order });
  return res;
};

/**
 * Cancel an order with credentials.
 * @param terminal - The Terminal instance.
 * @param credential - The credential object.
 * @param order - The order to be canceled.
 * @returns A promise that resolves to the response of the cancel order request.
 * @public
 */
export const cancelOrder = async <T>(
  terminal: Terminal,
  credential: ITypedCredential<T>,
  order: IOrder,
): Promise<IResponse<void>> => {
  const res = await terminal.client.requestForResponse<
    {
      order: IOrder;
      credential: ITypedCredential<T>;
    },
    void
  >('CancelOrder', { credential, order });
  return res;
};

/**
 * List orders with credentials.
 * @param terminal - The Terminal instance.
 * @param credential - The credential object.
 * @returns A promise that resolves to the response of the list orders request.
 * @public
 */
export const listOrders = async <T>(
  terminal: Terminal,
  credential: ITypedCredential<T>,
  account_id: string,
): Promise<IResponse<{ orders: IOrder[] }>> => {
  const res = await terminal.client.requestForResponse<
    {
      credential: ITypedCredential<T>;
      account_id: string;
    },
    { orders: IOrder[] }
  >('ListOrders', { credential, account_id });
  return res;
};
