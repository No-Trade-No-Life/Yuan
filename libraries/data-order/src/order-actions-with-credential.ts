import { Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { IOrder } from './interface';

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
  },
) => {
  const { submitOrder, modifyOrder, cancelOrder } = actions;
  if (submitOrder) {
    terminal.server.provideService<
      {
        order: IOrder;
        credential: {
          type: string;
          payload: T;
        };
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
      credential: {
        type: string;
        payload: T;
      };
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
      credential: {
        type: string;
        payload: T;
      };
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
};
