import { formatTime } from '@yuants/data-model';
import { PromRegistry, Terminal } from '@yuants/protocol';
import http from 'http';
import { EMPTY, catchError, defer, filter, first, from, map, mergeMap, tap, timeout, toArray } from 'rxjs';

const HV_URL = process.env.HV_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || 'MetricsCollector';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Metrics Collector',
  status: 'OK',
});

const MetricTerminalMetricFetchErrorsTotal = PromRegistry.create(
  'counter',
  'terminal_metrics_fetch_errors_total',
  'terminal_metrics_fetch_errors_total terminal metrics fetch error',
);

const server = http.createServer((req, res) => {
  try {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    from(term.terminalInfos$)
      .pipe(
        //
        first(),
        mergeMap((infos) =>
          from(infos).pipe(
            //
            mergeMap((info) =>
              defer(() => term.request('Metrics', info.terminal_id, {})).pipe(
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
        ),
      )
      .subscribe((metrics) => {
        res.statusCode = 200;
        res.end(metrics);
      });
  } catch {
    res.statusCode = 500;
    res.end();
  }
});

server.listen(8080);
