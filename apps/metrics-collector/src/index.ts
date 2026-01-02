import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import {
  EMPTY,
  catchError,
  defer,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  tap,
  timeout,
  toArray,
} from 'rxjs';

const terminal = Terminal.fromNodeEnv();

const MetricTerminalMetricFetchErrorsTotal = GlobalPrometheusRegistry.counter(
  'terminal_metrics_fetch_errors_total',
  'terminal_metrics_fetch_errors_total terminal metrics fetch error',
);

terminal.server.provideService<{}, { status: number; headers?: Record<string, string>; body: string }>(
  '/external/prometheus/metrics',
  {},
  async () => {
    try {
      const metrics = await firstValueFrom(
        from(terminal.client.resolveTargetServicesSync('Metrics', {})).pipe(
          //
          mergeMap((info) =>
            defer(() =>
              terminal.client.requestForResponseData<{}, { metrics: string }>(info.service_id, {}),
            ).pipe(
              //
              map((data) => data.metrics),
              filter((v): v is Exclude<typeof v, undefined> => !!v),
              map((content) =>
                [
                  // ISSUE: Add a comment to the beginning of the file to indicate the terminal_id
                  `# TERMINAL "${info.terminal_id}" START`,
                  content,
                  `# TERMINAL "${info.terminal_id}" END`,
                ].join('\n'),
              ),
              tap(() => {
                MetricTerminalMetricFetchErrorsTotal.labels({ terminal_id: info.terminal_id }).add(0);
              }),
              timeout({ each: 5000, meta: `RequestMetrics for ${info.terminal_id} Timeout` }),
              catchError((err) => {
                console.error(`RequestMetrics for ${info.terminal_id} timeout`, err);
                MetricTerminalMetricFetchErrorsTotal.labels({ terminal_id: info.terminal_id }).inc();
                return EMPTY;
              }),
            ),
          ),
          toArray(),
          tap((metrics) => {
            console.debug(formatTime(Date.now()), `MetricsFetched from terminals: ${metrics.length}`);
          }),
          map((metrics) => metrics.join('\n')),
        ),
      );

      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            },
            body: metrics,
          },
        },
      };
    } catch {
      return { res: { code: 0, message: 'OK', data: { status: 500, body: '' } } };
    }
  },
);
