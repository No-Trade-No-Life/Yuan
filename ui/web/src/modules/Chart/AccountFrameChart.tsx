import { Space } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSelector } from '../AccountInfo';
import { accountFrameSeries$ } from '../AccountInfo/model';
import { registerPage } from '../Pages';
import { Chart, ChartGroup, LineSeries } from './components/Charts';

registerPage('AccountFrameChart', () => {
  const { t, ready } = useTranslation('AccountFrameChart');
  const mapAccountIdToFrames = useObservableState(accountFrameSeries$);
  const accountIdOptions = useMemo(() => Object.keys(mapAccountIdToFrames), [mapAccountIdToFrames]);
  const [accountId, setAccountId] = useState('');
  const accountFrames = mapAccountIdToFrames[accountId] || [];

  const balanceData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp, value: e.balance })),
    [accountFrames],
  );

  const equityData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp, value: e.equity })),
    [accountFrames],
  );
  const marginData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp, value: e.margin })),
    [accountFrames],
  );
  const requireData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp, value: e.require })),
    [accountFrames],
  );
  const profitData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp, value: e.profit })),
    [accountFrames],
  );

  if (!ready) {
    return null;
  }

  return (
    <div style={{ height: '100%' }}>
      <Space>
        <AccountSelector value={accountId} onChange={setAccountId} candidates={accountIdOptions} />
      </Space>
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
