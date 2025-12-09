import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';

export const mapOrderDirectionToSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_SHORT':
      return 'buy';
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
      return 'sell';
  }
  throw new Error(`Unknown order direction: ${direction}`);
};

export const mapOrderDirectionToTradeSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'OPEN_SHORT':
      return 'open';
    case 'CLOSE_LONG':
    case 'CLOSE_SHORT':
      return 'close';
  }
  throw new Error(`Unknown order direction: ${direction}`);
};
