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
  if (step < 0) return roundToStep(value, -step, roundFn) * -1;
  if (step === 0) return value; // 如果 step 为 0，直接返回原值
  const x = roundFn(value / step) * step; // 可能的整数倍
  // 结果需要和 step 保持同等精度
  return +x.toFixed(getDecimals(step));
}

const getDecimals = (v: number) => {
  const match = v.toExponential().match(/^\d+(?:\.(\d+))?e([+-]\d+)$/);
  if (!match) return 0;
  const [, decimalPart, exponent] = match;
  return Math.max(0, (decimalPart?.length ?? 0) + -exponent);
};
