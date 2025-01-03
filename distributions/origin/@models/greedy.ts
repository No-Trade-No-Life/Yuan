import { useParamOHLC, useSinglePosition } from '@libs';
// 贪心策略
// 如果当前开盘价与前一根K线的高点或低点之间存在差距，贪婪策略会打开一个初始订单。如果开盘价大于前一个高点，则策略做多，如果开盘价低于前一个K线的低点，则开空仓。
// 开仓后，只要蜡烛的颜色与开仓一致，就会继续向同一方向填单。如果当前仓位是多头，将为每个后续的绿色蜡烛创建新的多头订单，反之亦然。这将继续进行，直到出现不同颜色的蜡烛
// 平仓逻辑为价格突破持仓平均价格的上0.5%或者下0.5%
export default () => {
  const { product_id, open, high, low, close } = useParamOHLC('SomeKey');

  const pL = useSinglePosition(product_id, 'LONG');
  const pS = useSinglePosition(product_id, 'SHORT');
  const flag = useRef(0);

  useEffect(() => {
    const idx = open.length - 1;
    const prevHigh = high[idx - 1];
    const prevLow = low[idx - 1];
    if (idx < 1) return;
    const netVolume = pL.volume - pS.volume;

    if (netVolume === 0) {
      if (open[idx] > prevHigh) {
        if (pL.volume === 0) {
          flag.current = 1;
          pL.setTargetVolume(1);
        }
      }
      if (open[idx] < prevLow) {
        if (pS.volume === 0) {
          flag.current = 1;
          pS.setTargetVolume(1);
        }
      }
    }

    //做多方向
    if (netVolume > 0) {
      //如果上一根
      if (close[idx - 1] > open[idx - 1] && flag.current == 1) {
        pL.setTargetVolume(pL.volume + 1);
      } else {
        flag.current = 0;
      }

      const price = pL.position_price;
      if (price < open[idx] * 0.995 || price > open[idx] * 1.005) {
        pL.setTargetVolume(0);
      }
    }
    //做空方向
    if (netVolume < 0) {
      if (close[idx - 1] < open[idx - 1] && flag.current == 1) {
        pS.setTargetVolume(pS.volume + 1);
      } else {
        flag.current = 0;
      }
      const price = pS.position_price;
      if (price < open[idx] * 0.995 || price > open[idx] * 1.005) {
        pS.setTargetVolume(0);
      }
    }
  }, [open.length]);
};
