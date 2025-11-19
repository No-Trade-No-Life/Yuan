/**
 * Represents a reactive time series of values over time.
 * @public
 */
export interface ITimeSeries<T> extends ReadonlyArray<T> {
  readonly timeFrame: ITimeFrame;
  tags: Record<string, string>;
  [index: number]: T;
  cleanLength(): number;
  commit(): void;
  calc(): void;
}

/**
 * Interface for the time frame container that manages time series.
 * @public
 */
export interface ITimeFrame {
  readonly list: ReadonlyArray<ITimeSeries<any>>;
  readonly time: ITimeSeries<number>;
  createTimeSeries<T>(tags: Record<string, string>, onCalc?: () => void): ITimeSeries<T>;
  commit(): void;
}
