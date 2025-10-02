import { IProduct, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service for TQ
export const productService = provideQueryProductsService(
  terminal,
  'TQ',
  async () => {
    // Fetch product data from TQ API
    const response = await fetch('https://openmd.shinnytech.com/t/md/symbols/latest.json');
    const symbols = await response.json();

    // Convert TQ symbols to IProduct format
    return Object.values(symbols)
      .filter((item: any) => ['FUTURE', 'FUTURE_INDEX', 'INDEX'].includes(item.class))
      .map((item: any): IProduct => {
        // Determine market_id based on product type
        return {
          datasource_id: 'TQ',
          product_id: item.instrument_id,
          name: item.ins_name,
          quote_currency: 'CNY',
          base_currency: '',
          value_scale_unit: '',
          value_based_cost: 0,
          volume_based_cost: 0,
          max_volume: 0,
          price_step: +item.price_tick,
          volume_step: 1,
          value_scale: item.volume_multiple,
          allow_long: true,
          allow_short: true,
          margin_rate: 0,
          max_position: 0,
          market_id: '',
          no_interest_rate: false,
        };
      });
  },
  {
    auto_refresh_interval: 86400_000, // Refresh daily (24 hours)
  },
);
