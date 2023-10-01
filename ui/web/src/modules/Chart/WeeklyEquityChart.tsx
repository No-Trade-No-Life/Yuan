import { Chart } from '@antv/g2';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { isDarkMode$ } from '../Workbench/darkmode';
import { accountPerformance$ } from '../AccountInfo/model';
import { useTranslation } from 'react-i18next';

export const WeeklyEquityChart = React.memo(() => {
  const [t] = useTranslation('WeeklyEquityChart');
  const accountPerformance = useObservableState(accountPerformance$);
  const data = useMemo(
    () =>
      accountPerformance._weekly_equity.map((v, i) => {
        return { week: i, value: v };
      }),
    [accountPerformance],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDarkMode = useObservableState(isDarkMode$);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const chart = new Chart({
        container: containerRef.current,
        theme: isDarkMode ? 'classicDark' : 'classic',
        // padding: 80,
        marginLeft: 80,
        autoFit: true,
      });
      chart.title(t('weekly_equity_chart'));
      chart.line().data(data).encode('x', 'week').encode('y', 'value');
      chart.render();
    }
  }, [data, isDarkMode]);
  return <div style={{ width: '100%', height: 400 }} ref={containerRef}></div>;
});
