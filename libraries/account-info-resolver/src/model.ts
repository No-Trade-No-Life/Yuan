import { IAccountInfo, IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';

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
  onPositionExit: (callback: (position: IPosition) => void) => { dispose: () => void };
}
