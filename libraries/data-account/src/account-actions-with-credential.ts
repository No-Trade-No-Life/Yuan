import { ITypedCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { IAccountInfo, IPosition } from './interface';
import { wrapAccountInfoInput } from './wrap-account-info-input';

const makeCredentialSchema = (type: string, payloadSchema: JSONSchema7): JSONSchema7 => {
  return {
    type: 'object',
    required: ['type', 'payload'],
    format: 'typed-credential',
    properties: {
      type: { type: 'string', const: type },
      payload: payloadSchema,
    },
  };
};

/**
 * Action handler for getting account information.
 * @public
 */
export type IActionHandlerOfGetAccountInfo<T> = (credential: T, account_id: string) => Promise<IPosition[]>;

/**
 * Action handler for listing accounts.
 * @public
 */
export type IActionHandlerOfListAccounts<T> = (credential: T) => Promise<
  Array<{
    account_id: string;
  }>
>;

/**
 * Provide account action services (list accounts, get account info) with credentials.
 * @param terminal - The Terminal instance.
 * @param type - credential type for routing, e.g. 'BINANCE', 'OKX'.
 * @param credentialSchema - The JSON schema for the credential payload.
 * @param actions - The action implementations.
 * @public
 */
export const provideAccountActionsWithCredential = <T>(
  terminal: Terminal,
  type: string,
  credentialSchema: JSONSchema7,
  actions: {
    listAccounts: IActionHandlerOfListAccounts<T>;
    getAccountInfo: IActionHandlerOfGetAccountInfo<T>;
  },
) => {
  terminal.server.provideService<{ credential: ITypedCredential<T> }, Array<{ account_id: string }>>(
    'ListAccounts',
    {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
      },
    },
    async (msg) => {
      return {
        res: { code: 0, message: 'OK', data: await actions.listAccounts(msg.req.credential.payload) },
      };
    },
  );

  terminal.server.provideService<{ credential: ITypedCredential<T>; account_id: string }, IAccountInfo>(
    'GetAccountInfo',
    {
      type: 'object',
      required: ['credential', 'account_id'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        account_id: { type: 'string' },
      },
    },
    async (msg) => {
      const data = await actions.getAccountInfo(msg.req.credential.payload, msg.req.account_id);
      return {
        res: {
          code: 0,
          message: 'OK',
          data: wrapAccountInfoInput(Date.now(), msg.req.account_id, data),
        },
      };
    },
  );
};
