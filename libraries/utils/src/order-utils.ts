/**
 * @remarks
 * 将 value 化整到 step 的整数倍
 *
 * @public
 */
export function roundToStep(
  value: number,
  step: number,
  /**
   * 取整方法
   *
   * Math.round / Math.ceil / Math.floor
   *
   * @default Math.round
   */
  roundFn = Math.round,
): number {
  const x = roundFn(value / step) * step; // 这一步运算可能会产生
  const d1 = step.toString().length;
  const d2 = Math.floor(step).toString().length;
  const d = Math.max(0, d1 - d2 - 1); // 小数点位数
  return +x.toFixed(d);
}
