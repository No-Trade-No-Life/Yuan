import { encodeOHLCSeriesId } from '@yuants/data-ohlc';
import {
  IInterestRateServiceMetadata,
  parseInterestRateServiceMetadataFromSchema,
  parseOHLCServiceMetadataFromSchema,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';

const terminal = Terminal.fromNodeEnv();

/**
 * 列出所有支持利率的品种系列ID以及对应的 Service Metadata
 * @returns
 */
export const listInterestRateSeriesIds = async () => {
  const product_ids = await requestSQL<{ product_id: string }[]>(
    terminal,
    // 必须是支持利率的品种
    `select product_id from product where no_interest_rate = false`,
  );

  const series_ids = new Map<string, 'forward' | 'backward'>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestInterestRate') continue;
      try {
        const meta = parseInterestRateServiceMetadataFromSchema(serviceInfo.schema);

        for (const { product_id } of product_ids) {
          if (!product_id.startsWith(meta.product_id_prefix)) continue;
          series_ids.set(product_id, meta.direction);
        }
      } finally {
      }
    }
  }

  return series_ids;
};

/**
 *
 * @returns
 */
export const listOHLCSeriesIds = async () => {
  const product_ids = await requestSQL<{ product_id: string }[]>(terminal, `select product_id from product`);

  const series_ids = new Map<string, 'forward' | 'backward'>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestOHLC') continue;
      try {
        const meta = parseOHLCServiceMetadataFromSchema(serviceInfo.schema);

        for (const { product_id } of product_ids) {
          if (!product_id.startsWith(meta.product_id_prefix)) continue;
          for (const duration of meta.duration_list) {
            const series_id = encodeOHLCSeriesId(product_id, duration);
            series_ids.set(series_id, meta.direction);
          }
        }
      } finally {
      }
    }
  }

  return series_ids;
};
