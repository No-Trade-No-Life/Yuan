import { IAccountInfo, IOrder, IProduct, createEmptyAccountInfo } from '@yuants/data-model';
import { AccountInfoResolver } from './index';
import { IAccountInfoResolver } from './model';

const product: IProduct = {
  product_id: 'BTCUSD',
  name: 'Bitcoin / US Dollar',
  quote_currency: 'USD',
  base_currency: 'BTC',
  price_step: 0.01,
  volume_step: 0.0001,
  value_scale: 1,
  margin_rate: 0.1,
  allow_long: true,
  allow_short: true,
  spread: 0.5,
};

describe('AccountInfoResolver', () => {
  // // FIXME: investigate why there's a floating point error
  // it(`order disorder arrival`, () => {
  //   const accountInfo = () => createEmptyAccountInfo('account456', 'USD', 100, 100_000_000);

  //   const buy1: IOrder = {
  //     order_id: 'order123',
  //     account_id: 'account456',
  //     product_id: 'BTCUSD',
  //     position_id: 'position123',
  //     volume: 0.5,
  //     order_type: 'LIMIT',
  //     order_direction: 'OPEN_LONG',
  //     price: 50000,
  //     submit_at: 1,
  //     filled_at: 1,
  //     traded_volume: 0.5,
  //     traded_price: 50000,
  //     order_status: 'TRADED',
  //   };

  //   const sell1: IOrder = {
  //     order_id: 'order124',
  //     account_id: 'account456',
  //     product_id: 'BTCUSD',
  //     position_id: 'position123',
  //     volume: 1,
  //     order_type: 'LIMIT',
  //     order_direction: 'CLOSE_LONG',
  //     price: 51000,
  //     submit_at: 3,
  //     filled_at: 3,
  //     traded_volume: 0.9,
  //     traded_price: 51000,
  //     order_status: 'TRADED',
  //   };

  //   const buy2: IOrder = {
  //     order_id: 'order125',
  //     account_id: 'account456',
  //     product_id: 'BTCUSD',
  //     position_id: 'position123',
  //     volume: 0.5,
  //     order_type: 'LIMIT',
  //     order_direction: 'OPEN_LONG',
  //     price: 55000,
  //     submit_at: 2,
  //     filled_at: 2,
  //     traded_volume: 0.5,
  //     traded_price: 50000,
  //     order_status: 'TRADED',
  //   };

  //   const resolver1: IAccountInfoResolver = new AccountInfoResolver();
  //   resolver1.updateAccountInfo(accountInfo());
  //   resolver1.updateProduct(product);
  //   resolver1.updateQuote('BTCUSD', { ask: 50000, bid: 49999 });

  //   resolver1.updateOrder(buy1);
  //   resolver1.updateOrder(buy2);
  //   resolver1.updateOrder(sell1);
  //   console.info(JSON.stringify(resolver1.mapAccountIdToAccountInfo.get('account456')));

  //   const resolver2: IAccountInfoResolver = new AccountInfoResolver();
  //   resolver2.updateAccountInfo(accountInfo());
  //   resolver2.updateProduct(product);
  //   resolver2.updateQuote('BTCUSD', { ask: 50000, bid: 49999 });

  //   resolver2.updateOrder(buy1);
  //   resolver2.updateOrder(sell1);
  //   resolver2.updateOrder(buy2);

  //   console.info(JSON.stringify(resolver2.mapAccountIdToAccountInfo.get('account456')));

  //   expect(resolver1.mapAccountIdToAccountInfo.get('account456')).toEqual(
  //     resolver2.mapAccountIdToAccountInfo.get('account456'),
  //   );
  // });

  it('single buy', () => {
    const initAccountInfo: IAccountInfo = createEmptyAccountInfo('account456', 'USD', 1, 100_000_000);

    const buy1: IOrder = {
      order_id: 'order123',
      account_id: 'account456',
      product_id: 'BTCUSD',
      position_id: 'position123',
      volume: 0.5,
      order_type: 'LIMIT',
      order_direction: 'OPEN_LONG',
      price: 50000,
      submit_at: 1,
      filled_at: 1,
      traded_volume: 0.5,
      traded_price: 50000,
      order_status: 'TRADED',
    };

    const resolver: IAccountInfoResolver = new AccountInfoResolver();
    resolver.updateAccountInfo(initAccountInfo);
    resolver.updateProduct(product);
    resolver.updateQuote('BTCUSD', { ask: 50000, bid: 49999 });
    resolver.updateOrder(buy1);
    resolver.updateQuote('BTCUSD', { ask: 50000, bid: 50000 });

    const actualAccountInfo = resolver.mapAccountIdToAccountInfo.get('account456');
    const expectedAccountInfo: IAccountInfo = {
      account_id: 'account456',
      money: {
        equity: 100_000_000,
        profit: 0,
        balance: 100_000_000,
        free: 99_997_500,
        used: 2500,
        leverage: 1,
        currency: 'USD',
      },
      positions: [
        {
          position_id: 'position123',
          account_id: 'account456',
          product_id: 'BTCUSD',
          position_price: 50000,
          closable_price: 50000,
          valuation: 25000,
          margin: 2500,
          volume: 0.5,
          free_volume: 0.5,
          floating_profit: 0,
          total_opened_volume: 0.5,
          updated_at: 1,
          direction: 'LONG',
        },
      ],
      currencies: [
        {
          equity: 100_000_000,
          profit: 0,
          balance: 100_000_000,
          free: 99_997_500,
          used: 2500,
          leverage: 1,
          currency: 'USD',
        },
      ],
      orders: [],
      updated_at: 0,
    };

    expect(actualAccountInfo).toEqual(expectedAccountInfo);
  });
});
