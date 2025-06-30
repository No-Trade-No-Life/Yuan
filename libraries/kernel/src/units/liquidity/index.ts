export interface ILiquidityInfo {
  started_at: number;
  ended_at: number;
  first: number;
  last: number;
  high: number;
  low: number;
}

export const reduceLiquidity = (acc: ILiquidityInfo, cur: ILiquidityInfo): ILiquidityInfo => {
  // case 1: acc is after cur, no overlap
  if (acc.ended_at <= cur.started_at) return cur;

  // case 2: cur is after acc, with overlap
  // if the cur has a higher high / lower low, it's surely occur after the acc
  if (acc.started_at <= cur.started_at && acc.ended_at > cur.started_at) {
    const started_at = acc.started_at;
    const ended_at = cur.ended_at;
    const first = acc.last;
    const last = cur.last;
    const high = cur.high > acc.high ? cur.high : Math.max(first, last);
    const low = cur.low < acc.low ? cur.low : Math.min(first, last);
    return { started_at, ended_at, first, last, high, low };
  }

  // case 3: cur contains acc
  // it cannot be determined whether the high and low of the cur occur before or after the acc.
  if (acc.started_at > cur.started_at && acc.ended_at < cur.ended_at) {
    const started_at = acc.started_at;
    const ended_at = cur.ended_at;
    const first = acc.last;
    const last = cur.last;
    const high = Math.max(first, last);
    const low = Math.min(first, last);
    return { started_at, ended_at, first, last, high, low };
  }

  throw new Error(`Error Liquidity: ${JSON.stringify({ acc, cur })}`);
};
