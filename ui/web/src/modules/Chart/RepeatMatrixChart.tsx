import { Chart } from '@antv/g2';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { isDarkMode$ } from '../../common/Darkmode';
import { recordTable$ } from '../Shell/model';

export const RepeatMatrixChart = React.memo((props: { name: string }) => {
  const recordTable = useObservableState(recordTable$);

  const data = useMemo(() => {
    const data = recordTable[props.name];
    return data ?? [];
  }, [recordTable, props.name]);

  const isDarkMode = useObservableState(isDarkMode$);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const chart = new Chart({
        container: containerRef.current,
        theme: isDarkMode ? 'classicDark' : 'classic',
        width: 1000,
        height: 1000,
        padding: 100,
      });
      const repeatMatrix = chart
        .repeatMatrix()
        .data(data)
        .encode('position', data.length === 0 ? [] : Object.keys(data[0]));
      repeatMatrix.point().encode('color', 'profit');
      chart.render();
    }
  }, [data, isDarkMode, props.name]);

  return <div style={{ width: 1000, height: 1000 }} ref={containerRef}></div>;
});
