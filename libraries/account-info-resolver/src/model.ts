import { IAccountInfo, IOrder, IPosition, IProduct } from '@yuants/data-model';

/**
 * @public
 */
export interface IAccountInfoResolver {
  updateOrder: (order: IOrder) => void;
  updateAccountInfo: (accountInfo: IAccountInfo) => void;
  updateQuote: (product_id: string, quote: { ask: number; bid: number }) => void;
  updateProduct: (product: IProduct) => void;

  mapAccountIdToAccountInfo: ReadonlyMap<string, IAccountInfo>;
  positionExit$: AsyncIterable<IPosition>;
}
