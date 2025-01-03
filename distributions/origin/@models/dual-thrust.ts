// Dual Thrust 策略
// 收盘价突破上轨，做多
// 收盘价突破下轨，做空
import { useMAX, useMIN, useParamNumber, useParamOHLC, useSimplePositionManager } from '@libs';

export default () => {
  const { product_id, open, high, low, close } = useParamOHLC('SomeKey');
  const N = useParamNumber('N', 20);
  const K1 = useParamNumber('K1', 0.2);
  const K2 = useParamNumber('K2', 0.2);

  // 计算 Dual Thrust 策略所需的指标
  const HH = useMAX(high, N);
  const HC = useMAX(close, N);
  const LC = useMIN(close, N);
  const LL = useMIN(low, N);
  // 避免中间指标在图表中显示，可能会显得杂乱
  useEffect(() => {
    HH.tags.display = 'none';
    HC.tags.display = 'none';
    LC.tags.display = 'none';
    LL.tags.display = 'none';
  }, []);
  const Range = useSeries('Range', close);
  useEffect(() => {
    const i = close.length - 1;
    Range[i] = Math.max(HH[i] - LC[i], HC[i] - LL[i]);
  });
  const Upper = useSeries('Upper', close, { display: 'line' });
  const Lower = useSeries('Lower', close, { display: 'line' });
  useEffect(() => {
    const i = close.length - 1;
    Upper[i] = open[i] + K1 * Range[i];
    Lower[i] = open[i] - K2 * Range[i];
  });

  // NOTE: 使用当前 K 线的上一根 K 线的收盘价，保证策略在 K 线结束时才会执行
  const idx = close.length - 2;
  // 设置仓位管理器
  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, product_id);

  useEffect(() => {
    if (idx < N) return; // 略过一开始不成熟的均线数据

    if (close[idx] > Upper[idx]) {
      setTargetVolume(1);
    }
    if (close[idx] < Lower[idx]) {
      setTargetVolume(-1);
    }
  }, [idx]);
};
