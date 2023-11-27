import { Select } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountFrameSeries$ } from '../AccountInfo/model';
import { registerPage } from '../Pages';
import { Chart, ChartGroup, LineSeries } from './components/Charts';

registerPage('AccountFrameChart', () => {
  const { t, ready } = useTranslation('AccountFrameChart');
  const mapAccountIdToFrames = useObservableState(accountFrameSeries$);
  const accountIdOptions = Object.keys(mapAccountIdToFrames);
  const [accountId, setAccountId] = useState(accountIdOptions[0] || '');
  const accountFrames = mapAccountIdToFrames[accountId] || [];

  const balanceData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.balance })),
    [accountFrames],
  );

  const equityData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.equity })),
    [accountFrames],
  );
  const marginData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.margin })),
    [accountFrames],
  );
  const requireData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.require })),
    [accountFrames],
  );
  const profitData = useMemo(
    () => accountFrames.map((e) => ({ timestamp: e.timestamp_in_us / 1000, value: e.profit })),
    [accountFrames],
  );

  if (!ready) {
    return null;
  }

  return (
    <div style={{ height: '100%' }}>
      <Select
        prefix={t('common:account')}
        value={accountId}
        onChange={(v) => {
          setAccountId(v as string);
        }}
        optionList={accountIdOptions.map((v) => ({ label: v, value: v }))}
      />
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
