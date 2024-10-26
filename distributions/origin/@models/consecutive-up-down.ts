// 连续上涨/下跌策略
// 如果至少连续 X 根K线的当前收盘价高于前一收盘价，则连续上涨/下跌策略进入多头。
// 如果至少连续 Y 根K线的当前收盘价低于前一收盘价，则它进入空头。
// 进入多头时平掉空头，进入空头时平掉多头
// X 和 Y 输入在策略设置中进行管理
// 并在附图中绘制连续上涨/下跌的信号的直方图
import { useParamNumber, useSeriesMap, useSinglePosition, useParamOHLC } from '@libs';

export default () => {
  const { product_id, close } = useParamOHLC('SomeKey');
  const idx = close.length - 2;
  const X = useParamNumber('X', 3);
  const Y = useParamNumber('Y', 5);

  const consecutiveUp = useSeriesMap('ConsecutiveUp', close, { display: 'hist', chart: 'new' }, (i) => {
    let count = 0;
    for (let j = i; j > i - X; j--) {
      if (close[j] > close[j - 1]) {
        count++;
      } else {
        break;
      }
    }
    return count >= X ? 1 : 0;
  });

  const consecutiveDown = useSeriesMap('ConsecutiveDown', close, { display: 'hist', chart: 'new' }, (i) => {
    let count = 0;
    for (let j = i; j > i - Y; j--) {
      if (close[j] < close[j - 1]) {
        count++;
      } else {
        break;
      }
    }
    return count >= Y ? 1 : 0;
  });

  const pL = useSinglePosition(product_id, 'LONG');
  const pS = useSinglePosition(product_id, 'SHORT');

  useEffect(() => {
    //如果连续上涨
    if (consecutiveUp[idx] === 1) {
      pL.setTargetVolume(1);
      pS.setTargetVolume(0);
    }

    //如果连续上涨
    if (consecutiveDown[idx] === 1) {
      pL.setTargetVolume(0);
      pS.setTargetVolume(1);
    }
  }, [idx]);
};
