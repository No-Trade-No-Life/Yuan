import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { MonoTypeOperatorFunction, tap } from 'rxjs';
import { IQuote } from '.';

const MetricsQuoteState = GlobalPrometheusRegistry.gauge(
  'quote_state',
  'The latest quote state from public data',
);

/**
 * @public
 */
export const setMetricsQuoteState =
  (terminal_id: string): MonoTypeOperatorFunction<Partial<IQuote>> =>
  (source$) => {
    return source$.pipe(
      tap((x) => {
        const fields = Object.keys(x).filter(
          (key) =>
            ![
              'datasource_id',
              'product_id',
              'updated_at',
              'interest_rate_prev_settled_at',
              'interest_rate_next_settled_at',
            ].includes(key),
        );
        for (const field of fields) {
          const value = Number((x as any)[field]);
          if (!isNaN(value)) {
            MetricsQuoteState.labels({
              terminal_id,
              product_id: x.product_id!,
              field,
            }).set(value);
          }
        }
      }),
    );
  };
