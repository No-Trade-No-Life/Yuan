/**
 * 计算 Parabolic SAR
 * @param high - 最高价序列
 * @param low - 最低价序列
 * @param start - 加速因子起始值
 * @param increment - 加速因子增量
 * @param max - 加速因子最大值
 */
export const useSAR = (
  high: Series,
  low: Series,
  start: number = 0.02,
  increment: number = 0.02,
  max: number = 0.2,
) => {
  const Name = `SAR(${start}, ${increment}, ${max})`;
  const U = useSeries(`${Name}.U`, high, { display: 'line' });
  const D = useSeries(`${Name}.D`, high, { display: 'line' });
  const MAX = useSeries('MAX', high); // 区间极大值
  const MIN = useSeries('MIN', high); // 区间极小值
  const AF = useSeries('AF', high); // Accelerate Factor
  const direction = useSeries('direction', high); // 1 for upward, -1 for downward, 0 for unknown

  useEffect(() => {
    const i = high.length - 1;
    if (i < 0) return;

    if (i === 0) {
      MAX[i] = high[i];
      MIN[i] = low[i];
      AF[i] = start;
      U[i] = high[i];
      D[i] = low[i];
      direction[i] = 0;
      return;
    }
    // U[i] = U[i - 1];
    // D[i] = D[i - 1];

    if (direction[i - 1] !== 1) {
      // 按下行处理

      // 检查是否向上反转
      if (high[i] >= U[i - 1]) {
        direction[i] = 1;
        MAX[i] = high[i];
        MIN[i] = low[i];
        U[i] = NaN; // MAX[i];
        D[i] = MIN[i - 1]; // 从上一个区间的最小值开始
        AF[i] = start;
        return;
      }
      direction[i] = direction[i - 1];
      // 检查是否创新低
      if (low[i] < MIN[i - 1]) {
        AF[i] = Math.min(max, AF[i - 1] + increment);
      } else {
        AF[i] = AF[i - 1];
      }
      // 维护区间极值
      MAX[i] = Math.max(MAX[i - 1], high[i]);
      MIN[i] = Math.min(MIN[i - 1], low[i]);

      U[i] = U[i - 1] + AF[i] * (MIN[i - 1] - U[i - 1]);
      D[i] = NaN; // MIN[i];
    } else {
      // 按上行处理

      // 检查是否向下反转
      if (low[i] <= D[i - 1]) {
        direction[i] = -1;
        MAX[i] = high[i];
        MIN[i] = low[i];
        AF[i] = start;
        U[i] = MAX[i - 1]; // 从上一个区间的最大值开始
        D[i] = NaN; // MIN[i];
        return;
      }
      direction[i] = direction[i - 1];
      // 检查是否创新高
      if (high[i] < MAX[i - 1]) {
        AF[i] = Math.min(max, AF[i - 1] + increment);
      } else {
        AF[i] = AF[i - 1];
      }
      // 维护区间极值
      MAX[i] = Math.max(MAX[i - 1], high[i]);
      MIN[i] = Math.min(MIN[i - 1], low[i]);
      U[i] = NaN; //MAX[i];
      D[i] = D[i - 1] + AF[i] * (MAX[i - 1] - D[i - 1]);
    }
  });
  return { U, D, direction, MAX, MIN, AF };
};
