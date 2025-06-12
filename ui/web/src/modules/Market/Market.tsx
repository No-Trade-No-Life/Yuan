import { IconDownload, IconRefresh } from '@douyinfe/semi-icons';
import { ButtonGroup, Layout, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { encodePath, formatTime } from '@yuants/data-model';
import { convertDurationToMilliseconds } from '@yuants/data-ohlc';
import {
  HistoryPeriodLoadingUnit,
  Kernel,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  RealtimePeriodLoadingUnit,
} from '@yuants/kernel';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import { useEffect, useMemo, useState } from 'react';
import {
  BehaviorSubject,
  defer,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  interval,
  lastValueFrom,
  map,
  mergeMap,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { CandlestickSeries, Chart, ChartGroup } from '../Chart/components/Charts';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { Button } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from '../Terminals';
import { requestSQL, escape } from '@yuants/sql';

registerPage('Market', () => {
  const params = usePageParams();
  const initialConfig = params as {
    datasource_id: string;
    product_id: string;
    duration?: string;
  };
  const datasource_id$ = new BehaviorSubject(initialConfig.datasource_id);
  const product_id$ = new BehaviorSubject(initialConfig.product_id);

  const datasource_id = useObservableState(datasource_id$);
  const product_id = useObservableState(product_id$);
  const terminal = useObservableState(terminal$);

  const durationOptions = useObservableState(
    useObservable(
      pipe(
        switchMap(([datasource_id, product_id, terminal]) =>
          defer(async () => {
            if (!terminal) return undefined;
            const sql = `select replace(series_id, ${escape(
              encodePath(datasource_id, product_id, ''),
            )}, '') as duration from series_collecting_task where table_name = 'ohlc' and series_id like ${escape(
              // LIKE % pattern 中的 \ 需要转义
              encodePath(datasource_id, product_id, '%').replaceAll('\\', '\\\\'),
            )}`;
            // console.info('ProductList Duration SQL:', sql);
            const data = await requestSQL<{ duration: string }[]>(terminal, sql);
            // console.info('ProductList Duration Data:', data);
            return data.map((x) => x.duration);
          }),
        ),
      ),
      [datasource_id, product_id, terminal],
    ),
  );

  const [duration, setDuration] = useState(initialConfig.duration);

  // const duration = useObservableState(duration$);
  const period_in_sec = useMemo(() => convertDurationToMilliseconds(duration || '') / 1000, [duration]);
  const TAKE_PERIODS = 10000; // 2x TradingView

  const scene = useMemo(() => {
    if (terminal && datasource_id && product_id && duration) {
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
        duration,
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
        duration,
      });

      return { kernel, periodDataUnit };
    }
    return null;
  }, [terminal, datasource_id, product_id, duration]);

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
          <div>周期 {duration}</div>
          <ButtonGroup>
            {durationOptions?.map((duration) => {
              return (
                <Button
                  onClick={async () => {
                    setDuration(duration);
                  }}
                >
                  {duration}
                </Button>
              );
            })}
          </ButtonGroup>
          <Button
            icon={<IconRefresh />}
            onClick={async () => {
              setCnt((x) => x + 1);
            }}
          ></Button>
          <Button
            icon={<IconDownload />}
            onClick={() => executeCommand('fetchOHLCV', { datasource_id, product_id, duration })}
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
  const { datasource_id, product_id, duration, start_time, end_time } = await showForm<{
    datasource_id: string;
    product_id: string;
    duration: string;
    start_time: string;
    end_time: string;
  }>(
    {
      type: 'object',
      properties: {
        datasource_id: { type: 'string' },
        product_id: { type: 'string' },
        duration: { type: 'string' },
        start_time: { type: 'string', format: 'datetime' },
        end_time: { type: 'string', format: 'datetime' },
      },
    },
    params,
  );
  const _start_time = new Date(start_time).getTime();
  const _end_time = new Date(end_time || Date.now()).getTime();

  const terminal = await firstValueFrom(terminal$.pipe(filter((x): x is Exclude<typeof x, null> => !!x)));
  Toast.info(`开始拉取 ${datasource_id} / ${product_id} / ${duration} 历史数据...`);
  await lastValueFrom(
    terminal.client
      .requestService('CollectSeries', {
        table_name: 'ohlc',
        series_id: encodePath(datasource_id, product_id, duration),
        started_at: _start_time,
        ended_at: _end_time,
      })
      .pipe(
        tap({
          next: (x) => {
            if (x.frame) {
              Toast.info(
                `拉取到 ${x.frame.fetched} 条数据 (${formatTime(x.frame.fetched_at)})，已存储到 ${
                  x.frame.saved
                } 条数据 (${formatTime(x.frame.saved_at)})`,
              );
            }
          },
          complete: () => {
            Toast.success(t('common:succeed'));
          },
          error: (err) => {
            Toast.error(t('common:failed') + `: ${err}`);
          },
        }),
      ),
  );
});
