import {
  useCounterParty,
  useParamNumber,
  useParamString,
  useSeriesMap,
  useSimplePositionManager,
} from '@libs';

// Shannon's re-balance strategy
export default () => {
  // Define parameters of the agent
  const datasource_id = useParamString('DataSource', 'Y');
  const product_id = useParamString('Product');
  const period = useParamString('Period', 'PT1H');
  const currency = useParamString('Currency', 'USD');
  // Get the product information and price data
  const product = useProduct(datasource_id, product_id);
  const { close } = useOHLC(datasource_id, product_id, period);
  // More parameters
  const initial_balance = useParamNumber('Initial Balance', 100_000);
  const threshold = useParamNumber('Threshold', 1);
  // Get the account information
  const accountInfo = useAccountInfo({ currency });
  // Use a simple position manager
  const [actualVolume, setVolume] = useSimplePositionManager(accountInfo.account_id, product_id);
  // Re-balance the position
  useEffect(() => {
    if (close.length < 2) return;
    const price = close[close.length - 1];
    const totalValue = accountInfo.money.equity + initial_balance;
    const totalValueToHold = totalValue * 0.5;
    // infer the volume to hold
    const valuePerVolume =
      (product.value_scale ?? 1) *
      (product.value_scale_unit ? 1 : price) *
      (product.quote_currency === accountInfo.money.currency ? 1 : -1 / price);
    const expectedVolume = totalValueToHold / valuePerVolume;
    // calculate the error rate
    const volume_step = product.volume_step ?? 1;
    const errorRate = Math.abs((actualVolume - expectedVolume) / volume_step);
    if (errorRate > threshold) {
      setVolume(roundToStep(expectedVolume, volume_step));
    }
  }, [close.length]);
  // Advanced: Visualize the equity and margin
  useSeriesMap('Equity', close, { display: 'line', chart: 'new' }, () => accountInfo.money.equity);
  useSeriesMap('Margin', close, { display: 'line', chart: 'new' }, () => accountInfo.money.used);
  // Advanced: use counter-party to show if we take the opposite position
  useCounterParty(accountInfo.account_id);
};
