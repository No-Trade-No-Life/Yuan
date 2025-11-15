import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { BasicUnit } from '../BasicUnit';
import { QuoteDataUnit } from '../QuoteDataUnit';

const MetricQuoteDataUnitQuotes = GlobalPrometheusRegistry.gauge(
  'quote_data_unit_quotes',
  'quote data unit quotes',
);
/**
 * @public
 */
export class QuoteMetricsUnit extends BasicUnit {
  constructor(public kernel: Kernel, public quoteDataUnit: QuoteDataUnit) {
    super(kernel);
  }

  onEvent(): void | Promise<void> {
    for (const quote of this.quoteDataUnit.listQuotes()) {
      MetricQuoteDataUnitQuotes.labels({
        kernel_id: this.kernel.id,
        datasource_id: quote.datasource_id,
        product_id: quote.product_id,
        side: 'ask',
      }).set(quote.ask);
      MetricQuoteDataUnitQuotes.labels({
        kernel_id: this.kernel.id,
        datasource_id: quote.datasource_id,
        product_id: quote.product_id,
        side: 'bid',
      }).set(quote.bid);
    }
  }
}
