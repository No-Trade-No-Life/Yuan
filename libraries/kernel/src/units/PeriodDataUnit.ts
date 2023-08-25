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

  /**
   * @deprecated - use 'periodUpdated$' to subscribe changes
   */
  currentPeriod: IPeriod | null = null;

  onEvent(): void {
    this.currentPeriod = null;
  }

  updatePeriod(period: IPeriod) {
    const key = [period.datasource_id, period.product_id, period.period_in_sec].join();
    const list = (this.data[key] ??= []);
    const idx = list.length - 1;
    const updateIdx = idx >= 0 && list[idx].timestamp_in_us === period.timestamp_in_us ? idx : idx + 1;
    this.currentPeriod = list[updateIdx] = period;
    // 抄送报价
    this.quoteDataUnit.mapProductIdToQuote[period.product_id] = {
      bid: period.close,
      ask: period.close + (period.spread || 0),
    };
    this._periodUpdated$.next(period);
  }
}
