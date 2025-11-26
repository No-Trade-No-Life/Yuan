import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { getAccountAssets, getAccountInfo, getPositionList, ICredential } from '../api/private-api';
import { encodePath } from '@yuants/utils';
import { submitOrder } from './orders/submitOrder';
import { modifyOrder } from './orders/modifyOrder';
import { cancelOrderAction } from './orders/cancelOrder';
import { listOrders } from './orders/listOrders';
import { getPoolPairList } from '../api/public-api';
import { IProduct } from '@yuants/data-product';

const terminal = Terminal.fromNodeEnv();

provideExchangeServices<ICredential>(terminal, {
  name: 'TURBOFLOW',
  credentialSchema: {
    type: 'object',
    required: ['private_key'],
    properties: {
      private_key: {
        type: 'string',
        description: 'ED25519 Private Key (base58 encoded)',
      },
    },
  },
  getCredentialId: async function (credential): Promise<string> {
    const accountInfo = await getAccountInfo(credential);

    return encodePath('TURBOFLOW', accountInfo.data.account_id);
  },
  listProducts: async () => {
    const data = await getPoolPairList();
    return data.data.map(
      (pair): IProduct => ({
        datasource_id: 'TURBOFLOW',
        product_id: encodePath('TURBOFLOW', 'PERP', pair.base_token, pair.pair_id),
        name: `${pair.base_token}-${pair.quote_token}`,
        quote_currency: pair.quote_token,
        base_currency: pair.base_token,
        price_step: 1e-15,
        volume_step: 1e-15,
        value_scale: 1,
        value_scale_unit: '',
        margin_rate: 1 / pair.max_leverage,
        value_based_cost: 0,
        volume_based_cost: 0,
        max_position: 0,
        max_volume: 0,
        allow_long: true,
        allow_short: true,
      }),
    );
  },
  getPositions: async function (credential) {
    const assetsResponse = await getAccountAssets(credential, {
      fill_coin_sub_info: '1',
    });

    const assetPositions = assetsResponse.data.list.map((x) =>
      makeSpotPosition({
        position_id: x.coin_code,
        product_id: encodePath('SPOT', x.coin_name),
        volume: parseFloat(x.available_balance),
        free_volume: parseFloat(x.available_balance),
        closable_price: 1,
      }),
    );

    const positionsResponse = await getPositionList(credential, { status: 'Holding' });

    const positions: IPosition[] = (positionsResponse.data.data || []).map((position) => {
      const side = position.side === 1 ? 'LONG' : 'SHORT';
      const holdSize = parseFloat(position.hold_size);
      const holdAv = parseFloat(position.hold_av);
      const unpnl = parseFloat(position.unpnl);
      const im = parseFloat(position.im);

      return {
        position_id: position.id,
        datasource_id: 'TURBOFLOW',
        product_id: encodePath('TURBOFLOW', 'PERP', position.symbol, position.pair_id),
        direction: side,
        volume: holdSize,
        free_volume: holdSize, // Assuming all volume is free
        position_price: holdAv,
        closable_price: holdAv,
        floating_profit: unpnl,
        valuation: holdSize * holdAv,
        margin: im,
      };
    });

    return [...assetPositions, ...positions];
  },
  getOrders: listOrders,
  getPositionsByProductId: function (credential: ICredential, product_id: string): Promise<IPosition[]> {
    throw new Error('Function not implemented.');
  },
  getOrdersByProductId: function (credential: ICredential, product_id: string): Promise<IOrder[]> {
    throw new Error('Function not implemented.');
  },
  submitOrder: submitOrder,
  modifyOrder: modifyOrder,
  cancelOrder: cancelOrderAction,
});
