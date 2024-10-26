// 海龟交易法，做多版本
// 当价格突破20日价格的最高价的时候，开仓做多
// 开仓后，当多头头寸在突破过去10日最低价处止盈离市。
// 开仓后，当市价继续向盈利方向突破1/2 ATR时加仓，止损位为2ATR, 每加仓一次，止损位就提高1/2 ATR
import {
  useATR,
  useCounterParty,
  useMAX,
  useMIN,
  useParamNumber,
  useParamOHLC,
  useRuleEffect,
  useSeriesMap,
  useSinglePosition,
} from '@libs';

export default () => {
  const { product_id, high, low, close } = useParamOHLC('SomeKey');
  const N = useParamNumber('N', 20);

  const HH = useMAX(high, N);
  const LL = useMIN(low, N);

  const accountInfo = useAccountInfo();

  const pL = useSinglePosition(product_id, 'LONG');
  const { ATR } = useATR(high, low, close, 14);
  const price_break = useRef(0);
  const idx = close.length - 2;

  useRuleEffect(
    '当价格突破N日价格的最高价时，首次开仓做多，同时记录当前价格',
    () => close[idx] > HH[idx - 1] && pL.volume === 0,
    () => {
      price_break.current = close[idx];
      pL.setTargetVolume(1);
    },
    [close.length],
  );

  useRuleEffect(
    '当多头头寸在突破过去10日最低价处止盈离市',
    () => pL.volume > 0 && close[idx] < LL[idx - 1],
    () => {
      pL.setTargetVolume(0);
    },
    [close.length],
  );

  useRuleEffect(
    '当市价继续向盈利方向突破1/2 atr时加仓，止损位为2*atr',
    () => pL.volume > 0 && close[idx] > price_break.current + 0.5 * ATR[idx],
    () => {
      pL.setTargetVolume(pL.volume + 1);
      pL.setStopLossPrice(price_break.current - 2 * ATR[idx]);
      price_break.current = close[idx];
    },
    [close.length],
  );
  useSeriesMap('净值', close, { display: 'line', chart: 'new' }, () => accountInfo.money.equity);
  useSeriesMap('成本', close, { display: 'line' }, () => pL.position_price);
  useCounterParty(accountInfo.account_id);
};
