import { useATR, useCCI, useParamOHLC, useRef, useSimplePositionManager } from '@libs';

/**
 * CCI 顺势交易策略
 *
 * 一种基于特定数字参数的逆势交易策略，称为“亚洲版的黄金切割率”。策略使用了两个指标：CCI（顺势指标）和 ATR（真实波幅度均值）。
 *
 * ### 关键参数
 *
 * - **CCI参数**：18（快线）和54（慢线）
 * - **ATR参数**：108
 *
 * ### 交易规则
 *
 * 1. **开仓**：
 *    - 多头信号：当CCI快线跌破负200，然后上穿慢线时，建立多单。
 *    - 空头信号：当CCI快线超过正200，然后下穿慢线时，建立空单。
 *
 * 2. **平仓**：
 *    - 多单平仓：当CCI快线超过正200，然后下穿慢线时，平多单。
 *    - 空单平仓：当CCI快线跌破负200，然后上穿慢线时，平空单。
 *
 * 3. **止损**：使用关键K线的6倍ATR值作为止损点位。
 *
 * 4. **止盈**：当CCI快线进入相反的200位阶，并产生相反的交叉信号时，进行平仓。
 *
 * ### 策略管理建议
 * - 结合顺势和逆势策略，比如5:5或6:4的比例，以平衡盘整期的亏损。
 * - 不断优化策略和风险控制，以在市场中长期生存。
 *
 */
export default () => {
  const { product_id, high, low, close } = useParamOHLC('SomeKey');
  const idx = close.length - 2;

  const cciFast = useCCI(high, low, close, 18);
  const cciSlow = useCCI(high, low, close, 54);
  const { ATR: atr108 } = useATR(high, low, close, 108);

  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, product_id);
  const stopLossPrice = useRef(close[idx] - 6 * atr108[idx]);

  useEffect(() => {
    if (idx < 108) return; // 确保ATR有足够的数据

    // 空头信号：当CCI快线进入正200以上，且下穿慢线时，建立空单。
    if (cciFast[idx] > 200 && cciFast[idx] < cciSlow[idx]) {
      setTargetVolume(-1);
      stopLossPrice.current = close[idx] + 6 * atr108[idx]; // 使用6倍ATR的值作为停损点位。
    }

    // 多头信号：当CCI快线进入负200以下，且上穿慢线时，建立多单。
    if (cciFast[idx] < -200 && cciFast[idx] > cciSlow[idx]) {
      setTargetVolume(1);
      stopLossPrice.current = close[idx] - 6 * atr108[idx]; // 使用6倍ATR的值作为停损点位。
    }

    // 多单平仓：当CCI快线进入正200以上，且下穿慢线时，平多单。
    if (targetVolume > 0 && cciFast[idx] > 200 && cciFast[idx] < cciSlow[idx]) {
      setTargetVolume(0);
    }
    // 空单平仓：当CCI快线进入负200以下，且上穿慢线时，平空单。
    if (targetVolume < 0 && cciFast[idx] < -200 && cciFast[idx] > cciSlow[idx]) {
      setTargetVolume(0);
    }

    // 停损条件
    if (
      (targetVolume > 0 && close[idx] < stopLossPrice.current) ||
      (targetVolume < 0 && close[idx] > stopLossPrice.current)
    ) {
      setTargetVolume(0);
    }
  }, [idx]);
};
