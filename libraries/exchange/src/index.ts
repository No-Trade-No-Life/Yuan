import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IResponse, Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
export * from './quote';
export * from './ohlc';
export * from './interest_rate';
export * from './types';

/**
 * Exchange Interface
 *
 * @public
 */
export interface IExchange<T = any> {
  /**
   * Exchange name / type (e.g. 'Binance', 'OKX')
   */
  name: string;

  /**
   * JSON Schema for the credential payload
   */
  credentialSchema: JSONSchema7;

  /**
   * Get credential ID from credential
   *
   * @param credential - The credential object
   */
  getCredentialId(credential: T): Promise<string>;

  /**
   * List all products
   */
  listProducts(): Promise<IProduct[]>;

  /**
   * Get all positions
   *
   * @param credential - The credential object
   */
  getPositions(credential: T): Promise<IPosition[]>;

  /**
   * Get all orders
   *
   * @param credential - The credential object
   */
  getOrders(credential: T): Promise<IOrder[]>;

  /**
   * Get positions by product_id
   *
   * @param credential - The credential object
   * @param product_id - The product ID
   */
  getPositionsByProductId(credential: T, product_id: string): Promise<IPosition[]>;

  /**
   * Get orders by product_id
   *
   * @param credential - The credential object
   * @param product_id - The product ID
   */
  getOrdersByProductId(credential: T, product_id: string): Promise<IOrder[]>;

  /**
   * Submit an order
   *
   * @param credential - The credential object
   * @param order - The order object
   */
  submitOrder(credential: T, order: IOrder): Promise<{ order_id: string }>;

  /**
   * Modify an order
   *
   * @param credential - The credential object
   * @param order - The order object
   */
  modifyOrder(credential: T, order: IOrder): Promise<void>;

  /**
   * Cancel an order
   *
   * @param credential - The credential object
   * @param order - The order object
   */
  cancelOrder(credential: T, order: IOrder): Promise<void>;
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
 * Provide exchange services
 *
 * @public
 */
export const provideExchangeServices = <T>(terminal: Terminal, exchange: IExchange<T>) => {
  const { name: type, credentialSchema } = exchange;

  // GetCredentialId
  terminal.server.provideService<{ credential: { type: string; payload: T } }, string>(
    'GetCredentialId',
    {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
      },
    },
    async (msg) => {
      const credentialId = await exchange.getCredentialId(msg.req.credential.payload);
      return { res: { code: 0, message: 'OK', data: credentialId } };
    },
  );

  // ListProducts
  terminal.server.provideService<void, IProduct[]>(
    'ListProducts',
    {
      type: 'object',
      required: ['type'],
      properties: {
        type: { const: exchange.name },
      },
    },
    async () => {
      const products = await exchange.listProducts();
      return { res: { code: 0, message: 'OK', data: products } };
    },
  );

  // GetPositions
  terminal.server.provideService<
    { credential: { type: string; payload: T }; product_id?: string },
    IPosition[]
  >(
    'GetPositions',
    {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        product_id: { type: 'string' },
      },
    },
    async (msg) => {
      if (msg.req.product_id) {
        const positions = await exchange.getPositionsByProductId(
          msg.req.credential.payload,
          msg.req.product_id,
        );
        return { res: { code: 0, message: 'OK', data: positions } };
      }
      const positions = await exchange.getPositions(msg.req.credential.payload);
      return { res: { code: 0, message: 'OK', data: positions } };
    },
  );

  // GetOrders
  terminal.server.provideService<{ credential: { type: string; payload: T }; product_id?: string }, IOrder[]>(
    'GetOrders',
    {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        product_id: { type: 'string' },
      },
    },
    async (msg) => {
      if (msg.req.product_id) {
        const orders = await exchange.getOrdersByProductId(msg.req.credential.payload, msg.req.product_id);
        return { res: { code: 0, message: 'OK', data: orders } };
      }
      const orders = await exchange.getOrders(msg.req.credential.payload);
      return { res: { code: 0, message: 'OK', data: orders } };
    },
  );

  // SubmitOrder
  terminal.server.provideService<
    { credential: { type: string; payload: T }; order: IOrder },
    { order_id: string }
  >(
    'SubmitOrder',
    {
      type: 'object',
      required: ['credential', 'order'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        order: { type: 'object' },
      },
    },
    async (msg) => {
      const result = await exchange.submitOrder(msg.req.credential.payload, msg.req.order);
      return { res: { code: 0, message: 'OK', data: result } };
    },
  );

  // ModifyOrder
  terminal.server.provideService<{ credential: { type: string; payload: T }; order: IOrder }, void>(
    'ModifyOrder',
    {
      type: 'object',
      required: ['credential', 'order'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        order: { type: 'object' },
      },
    },
    async (msg) => {
      await exchange.modifyOrder(msg.req.credential.payload, msg.req.order);
      return { res: { code: 0, message: 'OK' } };
    },
  );

  // CancelOrder
  terminal.server.provideService<{ credential: { type: string; payload: T }; order: IOrder }, void>(
    'CancelOrder',
    {
      type: 'object',
      required: ['credential', 'order'],
      properties: {
        credential: makeCredentialSchema(type, credentialSchema),
        order: { type: 'object' },
      },
    },
    async (msg) => {
      await exchange.cancelOrder(msg.req.credential.payload, msg.req.order);
      return { res: { code: 0, message: 'OK' } };
    },
  );
};

/**
 * Get credential ID
 *
 * @public
 */
export const getCredentialId = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
): Promise<IResponse<string>> => {
  return terminal.client.requestForResponse('GetCredentialId', { credential });
};

/**
 * List products
 *
 * @public
 */
export const listProducts = async (terminal: Terminal, type: string): Promise<IResponse<IProduct[]>> => {
  return terminal.client.requestForResponse('ListProducts', { type });
};

/**
 * Get positions
 *
 * @public
 */
export const getPositions = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
  product_id?: string,
): Promise<IResponse<IPosition[]>> => {
  return terminal.client.requestForResponse('GetPositions', { credential, product_id });
};

/**
 * Get orders
 *
 * @public
 */
export const getOrders = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
  product_id?: string,
): Promise<IResponse<IOrder[]>> => {
  return terminal.client.requestForResponse('GetOrders', { credential, product_id });
};

/**
 * Submit order
 *
 * @public
 */
export const submitOrder = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
  order: IOrder,
): Promise<IResponse<{ order_id: string }>> => {
  return terminal.client.requestForResponse('SubmitOrder', { credential, order });
};

/**
 * Modify order
 *
 * @public
 */
export const modifyOrder = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
  order: IOrder,
): Promise<IResponse<void>> => {
  return terminal.client.requestForResponse('ModifyOrder', { credential, order });
};

/**
 * Cancel order
 *
 * @public
 */
export const cancelOrder = async <T>(
  terminal: Terminal,
  credential: { type: string; payload: T },
  order: IOrder,
): Promise<IResponse<void>> => {
  return terminal.client.requestForResponse('CancelOrder', { credential, order });
};
