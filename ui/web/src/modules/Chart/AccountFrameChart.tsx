import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { accountFrameSeries$ } from '../AccountInfo/model';
import { registerPage } from '../Pages';
import { Chart, ChartGroup, LineSeries } from './components/Charts';
import { useTranslation } from 'react-i18next';

registerPage('AccountFrameChart', () => {
  const { t, ready } = useTranslation('AccountFrameChart');
  const positionValueSeries = useObservableState(accountFrameSeries$);

  const balanceData = useMemo(
    () => positionValueSeries.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.balance })),
    [positionValueSeries],
  );

  const equityData = useMemo(
    () => positionValueSeries.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.equity })),
    [positionValueSeries],
  );
  const marginData = useMemo(
    () => positionValueSeries.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.margin })),
    [positionValueSeries],
  );
  const requireData = useMemo(
    () => positionValueSeries.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.require })),
    [positionValueSeries],
  );
  const profitData = useMemo(
    () => positionValueSeries.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.profit })),
    [positionValueSeries],
  );

  if (!ready) {
    return null;
  }

  return (
    <div style={{ height: '100%' }}>
      <ChartGroup>
        <div style={{ height: '50%' }}>
          <Chart>
            <LineSeries options={{ title: t('balance'), color: 'yellow' }} data={balanceData} />
            <LineSeries options={{ title: t('equity'), color: 'green' }} data={equityData} />
          </Chart>
        </div>
        <div style={{ height: '50%' }}>
          <Chart>
            <LineSeries options={{ title: t('pnl'), color: 'purple' }} data={profitData} />
            <LineSeries options={{ title: t('used_margin'), color: 'green' }} data={marginData} />
            <LineSeries options={{ title: t('required_margin'), color: 'orange' }} data={requireData} />
          </Chart>
        </div>
      </ChartGroup>
    </div>
  );
});
