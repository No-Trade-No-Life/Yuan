import { useObservableState } from 'observable-hooks';
import React, { useMemo } from 'react';
import { accountFrameSeries$ } from '../AccountInfo/model';
import { Chart, ChartGroup, LineSeries } from './components/Charts';

export const AccountFrameChart = React.memo(() => {
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

  return (
    <div style={{ height: '100%' }}>
      <ChartGroup>
        <div style={{ height: '50%' }}>
          <Chart>
            <LineSeries options={{ title: '余额', color: 'yellow' }} data={balanceData} />
            <LineSeries options={{ title: '净值', color: 'green' }} data={equityData} />
          </Chart>
        </div>
        <div style={{ height: '50%' }}>
          <Chart>
            <LineSeries options={{ title: '浮动盈亏', color: 'purple' }} data={profitData} />
            <LineSeries options={{ title: '使用保证金', color: 'green' }} data={marginData} />
            <LineSeries options={{ title: '需要的保证金', color: 'orange' }} data={requireData} />
          </Chart>
        </div>
      </ChartGroup>
    </div>
  );
});
