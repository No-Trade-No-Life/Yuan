import { ITimeFrame, ITimeSeries } from './interfaces';

/**
 * The central container that manages all time series data within the same timeframe.
 * @public
 */
export class TimeFrame implements ITimeFrame {
  constructor() {
    this.list = this._list = [];
    this.time = this.createTimeSeries<number>({ id: 'time' });
  }

  private _list: ITimeSeries<any>[];
  list: readonly ITimeSeries<any>[];
  time: ITimeSeries<number>;

  createTimeSeries<T>(tags: Record<string, string>, onCalc: () => void = () => {}): ITimeSeries<T> {
    const data: T[] = [];
    let _cleanLength = 0;
    const proxy = new Proxy(data, {
      // proxy index setter
      set(target, prop, value) {
        const maybeIndex = Number(prop);
        if (!isNaN(maybeIndex)) {
          if (maybeIndex < _cleanLength) {
            _cleanLength = maybeIndex;
          }
        }

        return Reflect.set(target, prop, value);
      },
    });

    const series: ITimeSeries<any> = Object.assign(proxy, {
      tags,
      timeFrame: this,
      cleanLength: () => _cleanLength,
      commit: () => {
        _cleanLength = data.length;
      },
      calc: onCalc,
    });

    this._list.push(series);

    return series;
  }
  commit(): void {
    for (const ts of this._list) {
      ts.calc();
    }
    for (const ts of this._list) {
      ts.commit();
    }
  }
}
