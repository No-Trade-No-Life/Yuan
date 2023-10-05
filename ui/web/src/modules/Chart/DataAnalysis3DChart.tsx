import ReactECharts from 'echarts-for-react'; // or var ReactECharts = require('echarts-for-react');
import 'echarts-gl';
import React from 'react';

export const DataAnalysis3DChart = React.memo(function (props: {
  data: Array<{ x: number; y: number; z: number }>;
  labelX?: string;
  labelY?: string;
  labelZ?: string;
}) {
  return (
    <ReactECharts
      style={{ width: '100%', height: '100%' }}
      option={{
        grid3D: {},
        xAxis3D: { name: props.labelX || 'X' },
        yAxis3D: { name: props.labelY || 'Y' },
        zAxis3D: { name: props.labelZ || 'Z' },
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b} : {c}',
        },
        series: [
          {
            data: props.data.map((item) => [item.x, item.y, item.z]),
            type: 'scatter3D',
          },
        ],
      }}
      notMerge={true}
      lazyUpdate={true}
      opts={{ width: 'auto', height: 'auto' }}
    />
  );
});
