import { createCache } from '@yuants/cache';
import { IProduct } from '@yuants/data-product';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { filter, firstValueFrom, map } from 'rxjs';
import { ICThostFtdcInstrumentField, ICThostFtdcQryInstrumentField } from './assets/ctp-types';
import { DATASOURCE_ID, requestZMQ, terminal } from './context';

export const cachedProductId = new Set<string>();

export const cacheOfProduct = createCache<IProduct>(
  async (productId) => {
    const [exchangeId, instrumentId] = productId.split('-');
    return await firstValueFrom(
      requestZMQ<ICThostFtdcQryInstrumentField, ICThostFtdcInstrumentField>({
        method: 'ReqQryInstrument',
        params: {
          ExchangeID: exchangeId,
          reserve1: '',
          reserve2: '',
          reserve3: '',
          ExchangeInstID: '',
          ProductID: '',
          InstrumentID: instrumentId,
        },
      }).pipe(
        map((msg) => msg.res?.value),
        filter((value): value is ICThostFtdcInstrumentField => value !== undefined),
        map(
          (value): IProduct => ({
            datasource_id: DATASOURCE_ID,
            product_id: `${value.ExchangeID}-${value.InstrumentID}`,
            name: value.InstrumentName,
            quote_currency: 'CNY',
            price_step: value.PriceTick,
            value_scale: value.VolumeMultiple,
            volume_step: 1,
            base_currency: '',
            value_scale_unit: '',
            margin_rate: value.LongMarginRatio,
            value_based_cost: 0,
            volume_based_cost: 0,
            max_position: 0,
            max_volume: 0,
            allow_long: true,
            allow_short: true,
          }),
        ),
        filter((product) => product.product_id === productId),
      ),
    );
  },
  {
    expire: 24 * 3600 * 1000,
    writeLocal: (_, data) =>
      requestSQL(
        terminal,
        buildInsertManyIntoTableSQL([data], 'product', {
          conflictKeys: ['datasource_id', 'product_id'],
        }),
      ),
  },
);
