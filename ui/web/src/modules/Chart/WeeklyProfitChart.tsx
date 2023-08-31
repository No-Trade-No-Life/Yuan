import { Chart } from '@antv/g2';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { isDarkMode$ } from '../../common/Darkmode';
import { accountPerformance$ } from '../AccountInfo/model';

export const WeeklyProfitChart = React.memo(() => {
  const accountPerformance = useObservableState(accountPerformance$);
  const data = useMemo(
    () =>
      accountPerformance._weekly_return_ratio_list.map((v, i) => {
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
        autoFit: true,
        marginLeft: 80,
      });
      chart.title('每周盈亏分布图');
      chart.interval().data(data).encode('x', 'week').encode('y', 'value');
      chart.render();
    }
  }, [data, isDarkMode]);
  return <div style={{ width: '100%', height: 400 }} ref={containerRef}></div>;
});
