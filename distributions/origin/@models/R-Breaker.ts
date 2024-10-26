// R-Breaker 策略
// 高低周期的回转策略，根据高周期计算几个枢轴价位，然后在低周期上进行交易
import { useParamOHLC, useSinglePosition } from '@libs';
export default () => {
  // 设定参数
  const { product_id, close: C } = useParamOHLC('低周期'); // e.g. 1min
  const { high, low, close } = useParamOHLC('高周期'); // e.g. 1Day

  const idx = close.length - 2;
  const 中心价位 = (high[idx] + low[idx] + close[idx]) / 3;
  const 突破买入价 = high[idx] + 2 * 中心价位 - 2 * low[idx];
  const 观察卖出价 = 中心价位 + high[idx] - low[idx];
  const 反转卖出价 = 2 * 中心价位 - low[idx];
  const 反转买入价 = 2 * 中心价位 - high[idx];
  const 观察买入价 = 中心价位 - (high[idx] - low[idx]);
  const 突破卖出价 = low[idx] - 2 * (high[idx] - 中心价位);
  // 绘制采样点
  const _中心价位 = useSeries('中心价位', C, { display: 'line' });
  const _突破买入价 = useSeries('突破买入价', C, { display: 'line' });
  const _观察卖出价 = useSeries('观察卖出价', C, { display: 'line' });
  const _反转卖出价 = useSeries('反转卖出价', C, { display: 'line' });
  const _反转买入价 = useSeries('反转买入价', C, { display: 'line' });
  const _观察买入价 = useSeries('观察买入价', C, { display: 'line' });
  const _突破卖出价 = useSeries('突破卖出价', C, { display: 'line' });
  useEffect(() => {
    const i = C.length - 1;
    _中心价位[i] = 中心价位;
    _突破买入价[i] = 突破买入价;
    _观察卖出价[i] = 观察卖出价;
    _反转卖出价[i] = 反转卖出价;
    _反转买入价[i] = 反转买入价;
    _观察买入价[i] = 观察买入价;
    _突破卖出价[i] = 突破卖出价;
  });
  // 设置仓位管理器
  const pL = useSinglePosition(product_id, 'LONG');
  const pS = useSinglePosition(product_id, 'SHORT');

  const price = C[C.length - 1];

  useEffect(() => {
    if (pL.volume === 0 && pS.volume === 0) {
      if (price > 突破买入价) {
        pL.setTargetVolume(1);
      }
      if (price < 突破卖出价) {
        pS.setTargetVolume(1);
      }
    }
    if (pL.volume > 0 && high[high.length - 1] > 观察卖出价 && price < 反转卖出价) {
      pL.setTargetVolume(0);
      pS.setTargetVolume(1);
    }
    if (pS.volume > 0 && low[low.length - 1] < 观察买入价 && price > 反转买入价) {
      pL.setTargetVolume(1);
      pS.setTargetVolume(0);
    }
  }, [idx]);
};
