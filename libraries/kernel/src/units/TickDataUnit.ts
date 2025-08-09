import { IQuote } from '@yuants/data-quote';
import { Subject } from 'rxjs';
import { BasicUnit } from './BasicUnit';

/**
 * Tick Data
 * @public
 */
export class TickDataUnit extends BasicUnit {
  private _tickMap: Record<string, Record<string, IQuote>> = {};

  tickUpdated$ = new Subject<IQuote>();

  getTick(datasource_id: string, product_id: string): IQuote | undefined {
    return this._tickMap[datasource_id]?.[product_id];
  }

  setTick(tick: IQuote) {
    (this._tickMap[tick.datasource_id] ??= {})[tick.product_id] = tick;
    this.tickUpdated$.next(tick);
  }

  dump() {
    return {
      tickMap: this._tickMap,
    };
  }
  restore(state: any): void {
    this._tickMap = state.tickMap;
  }
}
