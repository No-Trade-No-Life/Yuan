import { PromRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { BasicUnit } from '../BasicUnit';
import { QuoteDataUnit } from '../QuoteDataUnit';

const MetricQuoteDataUnitQuotes = PromRegistry.create(
  'gauge',
  'quote_data_unit_quotes',
  'quote data unit quotes',
);
/**
 * @public
 */
export class QuoteMetricsUnit extends BasicUnit {
  constructor(public kernel: Kernel, public account_id: string, public quoteDataUnit: QuoteDataUnit) {
    super(kernel);
  }

  onEvent(): void | Promise<void> {
    for (const [product_id, quote] of Object.entries(this.quoteDataUnit.mapProductIdToQuote)) {
      MetricQuoteDataUnitQuotes.set(quote.ask, {
        account_id: this.account_id,
        product_id: product_id,
        side: 'ask',
      });
      MetricQuoteDataUnitQuotes.set(quote.bid, {
        account_id: this.account_id,
        product_id: product_id,
        side: 'bid',
      });
    }
  }
}
