import ccxt from 'ccxt';
import { makeProducts$, makeUseFundingRate, mapProductIdToSymbol, subscribeTick } from '.';
import { take, tap, timeout } from 'rxjs';

const SMOKE_TEST = process.env.SMOKE_TEST === 'true';

jest.setTimeout(15_000);
describe('ccxt functional tests', () => {
  const exchanges = ['binance', 'okx', 'gate'];
  const testSymbolForExchange: Record<string, string> = {
    binance: 'BTCUSDT',
    okx: 'BTC-USDT-SWAP',
    gate: 'BTC_USDT',
  };
  for (const exchangeName of exchanges) {
    //@ts-ignore
    const exchange = new ccxt[exchangeName]();
    // it(`should get products from ${exchangeName}`, (done) => {
    //   makeProducts$(exchange)
    //     .pipe(timeout({ each: 15_000, meta: `makeProducts$ from ${exchangeName}` }))
    //     .subscribe({
    //       next: (products) => {
    //         expect(products).toBeDefined();
    //         expect(products.length).toBeGreaterThan(0);
    //       },
    //       error: (error) => {
    //         done(error);
    //       },
    //       complete: () => {
    //         done();
    //       },
    //     });
    // });

    it(`should subscribe ticker from ${exchangeName}`, (done) => {
      if (!SMOKE_TEST) {
        done();
        return;
      }

      const useFundingRate = makeUseFundingRate(exchange);
      mapProductIdToSymbol[testSymbolForExchange[exchangeName]] = 'BTC/USDT:USDT';
      subscribeTick(
        exchange,
        useFundingRate,
      )(testSymbolForExchange[exchangeName])
        .pipe(
          //
          take(1),
          tap((tick): any => {
            console.info('tick', tick);
          }),
          timeout({ each: 5_000, meta: `subscribeTick from ${exchangeName}` }),
        )
        .subscribe({
          next: (tick) => {
            expect(tick).toBeDefined();
          },
          error: (error) => {
            done(error);
          },
          complete: () => {
            done();
          },
        });
    });
  }
});
