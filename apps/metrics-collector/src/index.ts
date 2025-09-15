import { PromRegistry, Terminal } from '@yuants/protocol';
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

const MetricTerminalMetricFetchErrorsTotal = PromRegistry.create(
  'counter',
  'terminal_metrics_fetch_errors_total',
  'terminal_metrics_fetch_errors_total terminal metrics fetch error',
);

terminal.server.provideService<{}, { status: number; headers?: Record<string, string>; body: string }>(
  '/external/prometheus/metrics',
  {},
  async () => {
    try {
      const metrics = await firstValueFrom(
        from(terminal.terminalInfos).pipe(
          //
          mergeMap((info) =>
            defer(() =>
              terminal.client.request<{}, { metrics: string }>('Metrics', info.terminal_id, {}),
            ).pipe(
              //
              map((data) => data.res?.data?.metrics),
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
                MetricTerminalMetricFetchErrorsTotal.add(0, { terminal_id: info.terminal_id });
              }),
              timeout({ each: 5000, meta: `RequestMetrics for ${info.terminal_id} Timeout` }),
              catchError((err) => {
                console.error(`RequestMetrics for ${info.terminal_id} timeout`, err);
                MetricTerminalMetricFetchErrorsTotal.inc({ terminal_id: info.terminal_id });
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
