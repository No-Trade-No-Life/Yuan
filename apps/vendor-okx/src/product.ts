import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service with the new design
export const productService = provideQueryProductsService(
  terminal,
  'OKX',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
    const products: IProduct[] = [];

    // Get all instrument types in parallel
    const [swapInstruments, marginInstruments, spotInstruments] = await Promise.all([
      client.getInstruments({ instType: 'SWAP' }),
      client.getInstruments({ instType: 'MARGIN' }),
      client.getInstruments({ instType: 'SPOT' }),
    ]);

    // Get USDT swap products
    for (const instrument of swapInstruments.data || []) {
      if (instrument.ctType === 'linear' && instrument.settleCcy === 'USDT' && +instrument.lever > 0) {
        products.push({
          datasource_id: 'OKX',
          product_id: encodePath(instrument.instType, instrument.instId),
          name: `${instrument.ctValCcy}-${instrument.settleCcy}-PERP`,
          base_currency: instrument.ctValCcy,
          quote_currency: instrument.settleCcy,
          value_scale: +instrument.ctVal,
          volume_step: +instrument.lotSz,
          price_step: +instrument.tickSz,
          margin_rate: 1 / +instrument.lever,
          value_scale_unit: '',
          value_based_cost: 0,
          volume_based_cost: 0,
          max_position: 0,
          max_volume: 0,
          allow_long: true,
          allow_short: true,
          market_id: 'OKX',
          no_interest_rate: false,
        });
      }
    }

    // Get margin products
    for (const instrument of marginInstruments.data || []) {
      if (+instrument.lever > 0) {
        products.push({
          datasource_id: 'OKX',
          product_id: encodePath(instrument.instType, instrument.instId),
          base_currency: instrument.baseCcy,
          quote_currency: instrument.quoteCcy,
          value_scale: 1,
          volume_step: +instrument.lotSz,
          price_step: +instrument.tickSz,
          margin_rate: 1 / +instrument.lever,
          name: `${instrument.baseCcy}-${instrument.quoteCcy}-MARGIN`,
          value_scale_unit: '',
          value_based_cost: 0,
          volume_based_cost: 0,
          max_position: 0,
          max_volume: 0,
          allow_long: true,
          allow_short: true,
          market_id: 'OKX',
          no_interest_rate: false,
        });
      }
    }

    // Get spot products
    for (const instrument of spotInstruments.data || []) {
      products.push({
        datasource_id: 'OKX',
        product_id: encodePath(instrument.instType, instrument.instId),
        base_currency: instrument.baseCcy,
        quote_currency: instrument.quoteCcy,
        value_scale: 1,
        volume_step: +instrument.lotSz,
        price_step: +instrument.tickSz,
        margin_rate: 1,
        name: `${instrument.baseCcy}-${instrument.quoteCcy}-SPOT`,
        value_scale_unit: '',
        value_based_cost: 0,
        volume_based_cost: 0,
        max_position: 0,
        max_volume: 0,
        allow_long: true,
        allow_short: true,
        market_id: 'OKX',
        no_interest_rate: true,
      });
    }

    return products;
  },
  {
    auto_refresh_interval: 3600_000,
  },
);
