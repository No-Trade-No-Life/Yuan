import { IPeriod } from '@yuants/protocol';
import { Observable, Subject } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { QuoteDataUnit } from './QuoteDataUnit';

/**
 * K线数据单元
 * @public
 */
export class PeriodDataUnit extends BasicUnit {
  constructor(public kernel: Kernel, public quoteDataUnit: QuoteDataUnit) {
    super(kernel);
  }

  private _periodUpdated$ = new Subject<IPeriod>();

  /** 更新Period事件 */
  periodUpdated$: Observable<IPeriod> = this._periodUpdated$.asObservable();

  data: Record<string, IPeriod[]> = {};

  updatePeriod(period: IPeriod) {
    const key = [period.datasource_id, period.product_id, period.period_in_sec].join();
    const list = (this.data[key] ??= []);
    const idx = list.length - 1;

    // ISSUE: skip if the period is older than the latest period
    if (list[idx]?.timestamp_in_us > period.timestamp_in_us) return;

    // Overwrite Period or Append Period
    const updateIdx = list[idx]?.timestamp_in_us === period.timestamp_in_us ? idx : idx + 1;
    // Update Period
    list[updateIdx] = period;
    // Copy to QuoteDataUnit
    this.quoteDataUnit.updateQuote(
      period.datasource_id,
      period.product_id,
      period.close + (period.spread || 0),
      period.close,
    );
    this._periodUpdated$.next(period);
  }

  dump(): {} {
    return {
      data: this.data,
    };
  }

  restore(state: any): void {
    this.data = state.data;
  }
}
