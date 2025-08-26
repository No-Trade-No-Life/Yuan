import { IInterestRate } from '@yuants/data-interest-rate';
import { createSeriesProvider, ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, map, mergeAll, timer } from 'rxjs';
import { client } from './api';
import { usdtSwapProducts$ } from './product';

createSQLWriter<ISeriesCollectingTask>(Terminal.fromNodeEnv(), {
  data$: usdtSwapProducts$.pipe(
    mergeAll(),
    map(
      (x): ISeriesCollectingTask => ({
        series_id: encodePath(x.datasource_id, x.product_id),
        table_name: 'interest_rate',
        cron_pattern: '0 * * * *', // 每小时执行一次
        cron_timezone: 'UTC',
        disabled: false,
        replay_count: 0,
      }),
    ),
  ),
  tableName: 'series_collecting_task',
  writeInterval: 1000,
  conflictKeys: ['series_id', 'table_name'],
});

createSeriesProvider<IInterestRate>(Terminal.fromNodeEnv(), {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const start = started_at || 0;
    const end = ended_at || Date.now();
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);

    if (instType === 'SWAP') {
      let current_end = end;
      while (true) {
        // 接口行为备注：向前翻页，时间降序，不含 after 当前时间点
        const res = await client.getFundingRateHistory({
          instId: instId,
          after: `${current_end}`,
        });
        if (res.code !== '0') {
          throw `getFundingRateHistory failed: ${res.code} ${res.msg}`;
        }
        // 如果没有数据了，就退出
        if (res.data.length === 0) {
          break;
        }
        console.info(formatTime(Date.now()), 'getFundingRateHistory', JSON.stringify(res.data));
        const data = res.data.map(
          (v): IInterestRate => ({
            series_id: series_id,
            product_id,
            datasource_id,
            created_at: formatTime(+v.fundingTime),
            long_rate: `${-v.fundingRate}`,
            short_rate: `${v.fundingRate}`,
            settlement_price: '',
          }),
        );
        yield data;
        current_end = +res.data[res.data.length - 1].fundingTime;
        if (current_end <= start) {
          break;
        }
        // for API rate limit
        await firstValueFrom(timer(1000));
      }
    }

    if (instType === 'MARGIN') {
      // MARGIN/BTC-USDT
      const [base, quote] = instId.split('-');
      let current_end = end;
      while (true) {
        const resBase = await client.getLendingRateHistory({ ccy: base, after: `${current_end}` });
        const resQuote = await client.getLendingRateHistory({ ccy: quote, after: `${current_end}` });

        if (resBase.code !== '0') {
          throw `getLendingRateHistory failed: ${resBase.code} ${resBase.msg}`;
        }
        if (resBase.data.length === 0) {
          break;
        }
        console.info(formatTime(Date.now()), 'getLendingRateHistory', JSON.stringify(resBase.data));

        if (resQuote.code !== '0') {
          throw `getLendingRateHistory failed: ${resQuote.code} ${resQuote.msg}`;
        }
        if (resQuote.data.length === 0) {
          break;
        }
        console.info(formatTime(Date.now()), 'getLendingRateHistory', JSON.stringify(resQuote.data));

        // 做多时，借入 quote 的资金，做空时，借入 base 的资金
        // 用 quote 的 rate 作为 long_rate，base 的 rate 作为 short_rate

        const mapTsToBaseRate = new Map<string, string>();
        resBase.data.forEach((v) => {
          mapTsToBaseRate.set(v.ts, v.rate);
        });

        const data: IInterestRate[] = [];

        resQuote.data.forEach((v) => {
          if (!mapTsToBaseRate.has(v.ts)) return;
          const long_rate = +v.rate / 365 / 24; // 转换为小时利率
          const short_rate = +mapTsToBaseRate.get(v.ts)! / 365 / 24; // 转换为小时利率
          data.push({
            series_id,
            product_id,
            datasource_id,
            created_at: formatTime(+v.ts),
            long_rate: `${-long_rate}`,
            short_rate: `${-short_rate}`,
            settlement_price: '',
          });
        });

        yield data;
        current_end = new Date(data[data.length - 1].created_at).getTime();
        if (current_end <= start) {
          break;
        }
        // for API rate limit
        await firstValueFrom(timer(1000));
      }
    }
  },
});
