import { IconDownload, IconRefresh } from '@douyinfe/semi-icons';
import { Button, Layout, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import {
  HistoryPeriodLoadingUnit,
  Kernel,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  RealtimePeriodLoadingUnit,
} from '@yuants/kernel';
import { copyDataRecords } from '@yuants/protocol';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import { useEffect, useMemo, useState } from 'react';
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  from,
  interval,
  map,
  mergeMap,
} from 'rxjs';
import { CandlestickSeries, Chart, ChartGroup } from '../Chart/components/Charts';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from '../Terminals';

registerPage('Market', () => {
  const params = usePageParams();
  const initialConfig = params as {
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
      const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit, {});
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

  const timestamp$ = useObservable(
    (s) =>
      s.pipe(
        mergeMap(([scene]) =>
          interval(1000).pipe(
            map(() => scene?.kernel.currentTimestamp),
            distinctUntilChanged(),
          ),
        ),
      ),
    [scene],
  );

  const timestamp = useObservableState(timestamp$);
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
          <Button
            icon={<IconDownload />}
            onClick={() => {
              executeCommand('fetchOHLCV', { datasource_id, product_id, period_in_sec });
            }}
          >
            拉取历史
          </Button>
          <Typography.Text>{timestamp && formatTime(timestamp)}</Typography.Text>
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

registerCommand('fetchOHLCV', async (params) => {
  const { datasource_id, product_id, period_in_sec, start_time, end_time } = await showForm<{
    datasource_id: string;
    product_id: string;
    period_in_sec: number;
    start_time: string;
    end_time: string;
  }>(
    {
      type: 'object',
      properties: {
        datasource_id: { type: 'string' },
        product_id: { type: 'string' },
        period_in_sec: { type: 'number' },
        start_time: { type: 'string', format: 'datetime' },
        end_time: { type: 'string', format: 'datetime' },
      },
    },
    params,
  );
  const _start_time = new Date(start_time).getTime();
  const _end_time = new Date(end_time).getTime();

  const terminal = await firstValueFrom(terminal$.pipe(filter((x): x is Exclude<typeof x, null> => !!x)));
  Toast.info(`开始拉取 ${datasource_id} / ${product_id} / ${period_in_sec} 历史数据...`);
  await copyDataRecords(terminal, {
    type: 'period',
    time_range: [_start_time, _end_time],
    tags: {
      datasource_id,
      product_id,
      period_in_sec: `${period_in_sec}`,
    },
    receiver_terminal_id: '',
  });
  Toast.info(t('common:succeed'));
});
