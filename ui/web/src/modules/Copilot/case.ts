import { UUID } from '@yuants/data-model';

export const exampleMessages = [
  {
    type: 'UserText',
    payload: {
      text: 'Show me a double moving average strategy',
    },
  },
  {
    type: 'CopilotForm',
    payload: {
      id: UUID(),
      schema: {
        title:
          '为了充分利用价格快速上涨带来的利益，建议设置在动能减弱或遇到关键技术位时适时退出市场的平仓策略',
        type: 'string',
        examples: [
          '当RSI高于70且开始出现下降趋势时平仓，以防止在过高的RSI指示可能的超买情况下，价格可能反转导致利润丧失',
          '若价格达到预设的阻力位或技术图形目标价位时平仓，以实现在价格可能出现回调前锁定利润',
          '通过移动止损，如跟踪止损，来确保在价格快速上涨时最大化利润同时保护已经获取的收益',
        ],
      },
    },
  },
  {
    type: 'CopilotText',
    payload: {
      text: `The double moving average model uses two simple moving averages (SMA), one with a short period and one with a long period. The model generates a buy signal when the short-period SMA crosses above the long-period SMA, and a sell signal when the short-period SMA crosses below the long-period SMA.`,
    },
  },
  {
    type: 'CopilotAgentCode',
    payload: {
      code: `// 双均线策略 (Double Moving Average)
// 当短期均线由下向上穿越长期均线时做多 (金叉)
// 当短期均线由上向下穿越长期均线时做空 (死叉)
import { useSMA, useSimplePositionManager } from "@libs";

export default () => {
  // 使用收盘价序列
  const { product_id, close } = useParamOHLC("SomeKey");
  // NOTE: 使用当前 K 线的上一根 K 线的收盘价，保证策略在 K 线结束时才会执行
  const idx = close.length - 2;

  // 使用 20，60 均线
  const sma20 = useSMA(close, 20);
  const sma60 = useSMA(close, 60);

  const accountInfo = useAccountInfo();

  // 设置仓位管理器
  const [targetVolume, setTargetVolume] = useSimplePositionManager(
    accountInfo.account_id,
    product_id
  );

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
`,
      remark:
        'The double moving average model uses two simple moving averages (SMA), one with a short period and one with a long period. The model generates a buy signal when the short-period SMA crosses above the long-period SMA, and a sell signal when the short-period SMA crosses below the long-period SMA. The useSeriesMap function is used to iterate over the data points and compare the current and previous values of the SMAs to determine the signals.',
    },
  },
];
