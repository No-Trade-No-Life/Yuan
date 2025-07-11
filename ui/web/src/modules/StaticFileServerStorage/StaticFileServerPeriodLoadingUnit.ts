import { IPeriod, IProduct } from '@yuants/data-model';
import { BasicUnit, Kernel, PeriodDataUnit, ProductDataUnit } from '@yuants/kernel';
import { formatTime } from '@yuants/utils';
import { parse as csvParse } from 'csv-parse/browser/esm/sync';
import { parse } from 'date-fns';
import { filter, from, lastValueFrom, map, mergeMap, toArray } from 'rxjs';

const mapPeriodToDuration: Record<string, string> = {
  60: 'PT1M',
  300: 'PT5M',
  900: 'PT15M',
  1800: 'PT30M',
  3600: 'PT1H',
  14400: 'PT4H',
  86400: 'P1D',
};

const parseTimeSeriesDataFilename = (filename: string) => {
  const format = 'yyyyMMdd_HHmmss';
  const [start, end] = filename.split('.')[0].split('-');
  return [parse(start, format, new Date()), parse(end, format, new Date())];
};

export class StaticFileServerPeriodLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public productDataUnit: ProductDataUnit,
    public periodDataUnit: PeriodDataUnit,
    public baseUrl?: string,
  ) {
    super(kernel);
    this.baseUrl = baseUrl || 'https://y.ntnl.io/Yuan-Public-Data';
  }

  private mapEventIdToPeriod = new Map<number, IPeriod>();

  periodTasks: {
    datasource_id: string;
    product_id: string;
    period_in_sec: number;
    start_time_in_us: number;
    end_time_in_us: number;
  }[] = [];

  async onInit() {
    this.kernel.log?.(`${formatTime(Date.now())} 正在加载历史行情数据: 共 ${this.periodTasks.length} 个任务`);
    const storageIndex: string[] = (await fetch(`${this.baseUrl}/index`).then((x) => x.text()))
      .split('\n')
      .filter((v) => v !== '');
    const mapProductIdToProduct: Record<string, IProduct> = Object.fromEntries(
      csvParse(await fetch(`${this.baseUrl}/products.csv`).then((x) => x.text()), {
        columns: true,
        skip_empty_lines: true,
      })
        .map(
          // TODO: Move this to protocol model
          (raw: any): IProduct => ({
            ...raw,
            price_step: +(raw.price_step || 1),
            volume_step: +(raw.volume_step || 1),
            value_scale: +(raw.value_scale || 1),
            margin_rate: +(raw.margin_rate || 1),
            spread: +(raw.spread || 0),
            allow_long: raw.allow_long === 'true',
            allow_short: raw.allow_short === 'true',
          }),
        )
        .map((v: IProduct) => [v.product_id, v]),
    );
    for (const task of this.periodTasks) {
      if (!this.productDataUnit.getProduct(task.datasource_id, task.product_id)) {
        this.productDataUnit.updateProduct(
          mapProductIdToProduct[task.product_id] || {
            datasource_id: task.datasource_id,
            product_id: task.product_id,
          },
        );
      }
    }
    for (const task of this.periodTasks) {
      const dirPath = `OHLC/${task.product_id}/${mapPeriodToDuration[task.period_in_sec]}`;
      const files = storageIndex.filter((path) => path.startsWith(dirPath));
      const theProduct = this.productDataUnit.getProduct(task.datasource_id, task.product_id);
      if (files.length === 0) {
        this.kernel.log?.(
          `${formatTime(Date.now())} 未找到 "${task.product_id}" / "${task.period_in_sec}" 的历史数据`,
        );
        continue;
      }

      const filteredFiles = files.filter((filePath) => {
        const [fileStart, fileEnd] = parseTimeSeriesDataFilename(filePath.split('/').pop()!);
        return (
          fileStart.getTime() <= task.end_time_in_us / 1000 &&
          fileEnd.getTime() >= task.start_time_in_us / 1000
        );
      });

      await lastValueFrom(
        from(filteredFiles).pipe(
          //
          mergeMap((filePath) => fetch(`${this.baseUrl}/${filePath}`).then((x) => x.text())),

          mergeMap((text) => csvParse(text, { columns: true, skip_empty_lines: true })),
          map(
            // TODO: Move it to protocol model
            (raw: any): IPeriod => ({
              timestamp_in_us: new Date(raw.time).getTime() * 1000,
              open: +raw.open,
              high: +raw.high,
              low: +raw.low,
              close: +raw.close,
              volume: +raw.volume,
              datasource_id: 'Y',
              product_id: task.product_id,
              period_in_sec: task.period_in_sec,
            }),
          ),
          filter(
            (period) =>
              period.timestamp_in_us >= task.start_time_in_us &&
              period.timestamp_in_us <= task.end_time_in_us,
          ),
          toArray(),
          map((periods) => {
            periods.sort((a, b) => a.timestamp_in_us - b.timestamp_in_us);
            periods.forEach((period, idx) => {
              const spread = period.spread || theProduct?.spread || 0;
              // Push Period Data
              // ISSUE: Push the K-line at the opening time into the queue, which generates a simulated event,
              //        which can confirm the closing of the previous K-line early
              const openEventId = this.kernel.alloc(period.timestamp_in_us / 1000);
              this.mapEventIdToPeriod.set(openEventId, {
                ...period,
                high: period.open,
                low: period.open,
                close: period.open,
                volume: 0,
                spread,
              });
              // ISSUE: Generally speaking, the closing timestamp of the K-line is the opening timestamp + period,
              //        but in historical data, the closing timestamp of the K-line may be earlier than the opening timestamp + period
              const inferred_close_timestamp = Math.min(
                period.timestamp_in_us / 1000 + period.period_in_sec * 1000 - 1,
                (periods[idx + 1]?.timestamp_in_us ?? Infinity) / 1000 - 1,
                Date.now(),
              );
              const closeEventId = this.kernel.alloc(inferred_close_timestamp);
              this.mapEventIdToPeriod.set(closeEventId, { ...period, spread });
            });
            return periods;
          }),
        ),
      );
    }
  }

  onEvent(): void | Promise<void> {
    const period = this.mapEventIdToPeriod.get(this.kernel.currentEventId);
    if (period) {
      this.periodDataUnit.updatePeriod(period);
      this.mapEventIdToPeriod.delete(this.kernel.currentEventId);
    }
  }
}
