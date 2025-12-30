// 发现所有支持利率的品种系列ID

import { IInterestRateServiceMetadata, parseInterestRateServiceMetadataFromSchema } from '@yuants/exchange';
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

  const series_ids = new Map<string, IInterestRateServiceMetadata>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestInterestRate') continue;
      try {
        const meta = parseInterestRateServiceMetadataFromSchema(serviceInfo.schema);

        for (const { product_id } of product_ids) {
          if (!product_id.startsWith(meta.product_id_prefix)) continue;
          series_ids.set(product_id, meta);
        }
      } finally {
      }
    }
  }

  return series_ids;
};
