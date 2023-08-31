import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Layout, Space, Typography } from '@douyinfe/semi-ui';
import {
  HistoryPeriodLoadingUnit,
  Kernel,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  RealtimePeriodLoadingUnit,
} from '@yuants/kernel';
import { TabNode } from 'flexlayout-react';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { BehaviorSubject, distinctUntilChanged, interval, map, mergeMap } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { CandlestickSeries, Chart, ChartGroup } from '../Chart/components/Charts';

export const Market = React.memo((props: { node?: TabNode }) => {
  const initialConfig = (props.node?.getConfig() ?? {
    datasource_id: '',
    product_id: '',
    period_in_sec: 0,
  }) as {
    datasource_id: string;
    product_id: string;
    period_in_sec: number;
  };
  const datasource_id$ = new BehaviorSubject(initialConfig.datasource_id);
  const product_id$ = new BehaviorSubject(initialConfig.product_id);
  const period_in_sec$ = new BehaviorSubject(initialConfig.period_in_sec);

  const datasource_id = useObservableState(datasource_id$);
  const product_id = useObservableState(product_id$);
  const period_in_sec = useObservableState(period_in_sec$);
  const terminal = useObservableState(terminal$);
  const TAKE_PERIODS = 10000; // 2x TradingView

  const scene = useMemo(() => {
    if (terminal && datasource_id && product_id && period_in_sec) {
      const kernel = new Kernel();
      const productDataUnit = new ProductDataUnit(kernel);
      const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit, {
        allow_fallback_specific_product: true,
      });
      const quoteDataUnit = new QuoteDataUnit(kernel);
      const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
      const periodLoadingUnit = new HistoryPeriodLoadingUnit(
        kernel,
        terminal,
        productDataUnit,
        periodDataUnit,
      );
      productLoadingUnit.productTasks.push({
        datasource_id,
        product_id,
      });
      periodLoadingUnit.periodTasks.push({
        datasource_id,
        product_id,
        period_in_sec,
        start_time_in_us: (Date.now() - TAKE_PERIODS * period_in_sec * 1000) * 1000,
        end_time_in_us: Date.now() * 1000,
      });
      const realtimePeriodLoadingUnit = new RealtimePeriodLoadingUnit(
        kernel,
        terminal,
        productDataUnit,
        periodDataUnit,
      );
      realtimePeriodLoadingUnit.periodTasks.push({
        datasource_id,
        product_id,
        period_in_sec,
      });

      return { kernel, periodDataUnit };
    }
    return null;
  }, [terminal, datasource_id, product_id, period_in_sec]);

  useEffect(() => {
    if (scene) {
      scene.kernel.start();
      return () => {
        scene.kernel.terminate();
      };
    }
  }, [scene]);

  const status$ = useObservable(
    (s) =>
      s.pipe(
        mergeMap(([scene]) =>
          interval(1000).pipe(
            map(() => scene?.kernel.status),
            distinctUntilChanged(),
          ),
        ),
      ),
    [scene],
  );

  const status = useObservableState(status$);
  const [cnt, setCnt] = useState(0);

  const periodKey = [datasource_id, product_id, period_in_sec].join();
  const periods = scene?.periodDataUnit.data[periodKey] ?? [];

  return (
    <Layout style={{ width: '100%', height: '100%' }}>
      <Layout.Header>
        <Space>
          <div>数据源 {datasource_id}</div>
          <div>品种 {product_id}</div>
          <div>
            周期{' '}
            {{
              60: '1分钟',
              300: '5分钟',
              900: '15分钟',
              1800: '30分',
              3600: '1小时',
              14400: '4小时',
              86400: '日线',
            }[period_in_sec] ?? `自定义周期: ${period_in_sec}秒`}
          </div>
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              setCnt((x) => x + 1);
            }}
          ></Button>
          <Typography.Text>内核状态: {status}</Typography.Text>
        </Space>
      </Layout.Header>
      <Layout.Content>
        <ChartGroup key={cnt}>
          <Chart>
            <CandlestickSeries title={periodKey} data={periods} />
          </Chart>
        </ChartGroup>
      </Layout.Content>
    </Layout>
  );
});
