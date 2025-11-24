import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { firstValueFrom } from 'rxjs';
import { getSwapCrossPositionInfo, getUnifiedAccountInfo, ICredential } from '../api/private-api';
import { swapProductService } from '../product';

export const getSwapAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  // balance
  const balance = await getUnifiedAccountInfo(credential);
  if (!balance.data) {
    throw new Error('Failed to get unified account info');
  }
  const balanceData = balance.data.find((v) => v.margin_asset === 'USDT');
  if (!balanceData) {
    throw new Error('No USDT balance found in unified account');
  }
  const equity = balanceData.margin_balance;
  const free = balanceData.withdraw_available;

  // positions
  const positionsRes = await getSwapCrossPositionInfo(credential);
  const mapProductIdToPerpetualProduct = await firstValueFrom(swapProductService.mapProductIdToProduct$);
  const positions: IPosition[] = (positionsRes.data || []).map((v): IPosition => {
    const product_id = v.contract_code;
    const theProduct = mapProductIdToPerpetualProduct?.get(product_id);
    const valuation = v.volume * v.last_price * (theProduct?.value_scale || 1);
    return {
      position_id: `${v.contract_code}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
      datasource_id: 'HUOBI-SWAP',
      product_id,
      direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
      volume: v.volume,
      free_volume: v.available,
      position_price: v.cost_hold,
      closable_price: v.last_price,
      floating_profit: v.profit_unreal,
      valuation,
    };
  });

  // orders
  // const orders: IOrder[] = [];
  // let page_index = 1;
  // const page_size = 50;

  // while (true) {
  //   const ordersRes = await client.getSwapOpenOrders({ page_index, page_size });
  //   if (!ordersRes.data?.orders || ordersRes.data.orders.length === 0) {
  //     break;
  //   }

  //   const pageOrders: IOrder[] = ordersRes.data.orders.map((v): IOrder => {
  //     return {
  //       order_id: v.order_id_str,
  //       account_id: SWAP_ACCOUNT_ID,
  //       product_id: v.contract_code,
  //       order_type: ['lightning'].includes(v.order_price_type)
  //         ? 'MARKET'
  //         : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
  //             v.order_price_type,
  //           )
  //         ? 'LIMIT'
  //         : ['fok'].includes(v.order_price_type)
  //         ? 'FOK'
  //         : v.order_price_type.includes('ioc')
  //         ? 'IOC'
  //         : 'STOP', // unreachable code
  //       order_direction:
  //         v.direction === 'open'
  //           ? v.offset === 'buy'
  //             ? 'OPEN_LONG'
  //             : 'OPEN_SHORT'
  //           : v.offset === 'buy'
  //           ? 'CLOSE_SHORT'
  //           : 'CLOSE_LONG',
  //       volume: v.volume,
  //       submit_at: v.created_at,
  //       price: v.price,
  //       traded_volume: v.trade_volume,
  //     };
  //   });

  //   orders.push(...pageOrders);
  //   page_index++;
  // }

  return positions;
};
