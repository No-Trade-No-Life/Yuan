import { IOHLC } from '@yuants/data-ohlc';
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

  private _periodUpdated$ = new Subject<IOHLC>();

  /** 更新Period事件 */
  periodUpdated$: Observable<IOHLC> = this._periodUpdated$.asObservable();

  data: Record<string, IOHLC[]> = {};

  updatePeriod(period: IOHLC) {
    const key = [period.datasource_id, period.product_id, period.duration].join();
    const list = (this.data[key] ??= []);
    const idx = list.length - 1;

    // ISSUE: skip if the period is older than the latest period
    if (list[idx] && new Date(list[idx].created_at) > new Date(period.created_at)) return;

    // Overwrite Period or Append Period
    const updateIdx =
      list[idx] && new Date(list[idx].created_at).getTime() === new Date(period.created_at).getTime()
        ? idx
        : idx + 1;
    // Update Period
    list[updateIdx] = period;
    // Copy to QuoteDataUnit
    this.quoteDataUnit.updateQuote(period.datasource_id, period.product_id, +period.close, +period.close);
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
