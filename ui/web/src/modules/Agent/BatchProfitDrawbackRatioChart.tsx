import { Chart } from '@antv/g2';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { isDarkMode$ } from '../Workbench/darkmode';
import { IBatchAgentResultItem } from './utils';

export const BatchProfitDrawbackRatioChart = React.memo((props: { results: IBatchAgentResultItem[] }) => {
  const data = useMemo(
    () =>
      props.results
        .map((v) => {
          return {
            value: v.performance.profit_drawdown_ratio,
            as_counterparty: !!v.agentConf.as_counterparty,
          };
        })
        .filter((x) => x.value !== Infinity && x.value !== -Infinity),
    [props.results],
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
      chart.title('收益回撤比分布直方图');
      chart
        .rect()
        .data(data)
        .encode('x', 'value')
        .encode('color', 'as_counterparty')
        .transform({ type: 'binX', y: 'count' })
        .transform({ type: 'stackY', orderBy: 'series' })
        .style('inset', 0.5);
      chart.render();
    }
  }, [data, isDarkMode]);
  return <div style={{ width: '100%', height: 400 }} ref={containerRef}></div>;
});
