// 使用了 HP Filter 的双均线策略
import { useHPFilter, useParamNumber, useParamOHLC, useSMA, useSimplePositionManager } from '@libs';

export default () => {
  const { product_id, close } = useParamOHLC('SomeKey'); // 使用收盘价序列
  const lambda = useParamNumber('HP Filter 平滑系数');
  // NOTE: 使用当前 K 线的上一根 K 线的收盘价，保证策略在 K 线结束时才会执行
  const idx = close.length - 2;

  const hp = useHPFilter(close, lambda);

  // 使用 20，60 均线
  const sma20 = useSMA(hp, 20);
  const sma60 = useSMA(hp, 60);

  // 设置仓位管理器
  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, product_id);

  useEffect(() => {
    if (idx < 60) return; // 略过一开始不成熟的均线数据
    // 金叉开多平空
    if (sma20[idx] > sma60[idx]) {
      setTargetVolume(1);
    }
    // 死叉开空平多
    if (sma20[idx] < sma60[idx]) {
      setTargetVolume(-1);
    }
  }, [idx]);
};
