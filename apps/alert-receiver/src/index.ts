import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import Ajv from 'ajv';
import express from 'express';
import { readFile } from 'fs';
import { JSONSchema7 } from 'json-schema';
import moment from 'moment-timezone';
import {
  bindNodeCallback,
  catchError,
  defer,
  delay,
  EMPTY,
  filter,
  first,
  from,
  map,
  mergeMap,
  of,
  repeat,
  shareReplay,
  Subject,
  tap,
  timeout,
  toArray,
} from 'rxjs';

/// Alert manager 消息
interface IAlertManagerMessage {
  receiver: string;
  status: string;
  alerts: IAlertManagerItem[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts: number;
}

interface IAlertManagerItem {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

interface IAlertInfo {
  /** current value of the alerting metrics */
  metric_value?: number;
  /** alert start time */
  start_time: number;
  /** alert end time */
  end_time: number;
  /** description of alert */
  description?: string;
  /** status of the alert */
  resolved: boolean;
}

interface IAlertGroup {
  name: string;
  /** Severity */
  severity: AlertSeverity;
  env: string;
  summary: string;
  run_book_url?: string;
  alerts: IAlertInfo[];
  external_url?: string;
}

enum AlertSeverity {
  UNKNOWN = 'UNKNOWN',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface IAlertReceiverConfig {
  receivers: Array<{
    receiver_id: string;
    route: string;
    type: string;
  }>;
  notify_terminals: Record<string, string>;
  route_match: {
    UNKNOWN: string;
    INFO: string;
    WARNING: string;
    ERROR: string;
    CRITICAL: string;
  };
}

const configSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    receivers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['receiver_id', 'route', 'type'],
        properties: {
          receiver_id: {
            type: 'string',
          },
          route: {
            type: 'string',
          },
          type: {
            type: 'string',
          },
        },
      },
    },
    notify_terminals: {
      // TODO(wsy): validate for record
      type: 'object',
    },
    route_match: {
      type: 'object',
      required: ['UNKNOWN', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
      properties: {
        UNKNOWN: {
          type: 'string',
        },
        INFO: {
          type: 'string',
        },
        WARNING: {
          type: 'string',
        },
        ERROR: {
          type: 'string',
        },
        CRITICAL: {
          type: 'string',
        },
      },
    },
  },
};

const ajv = new Ajv();
const validate = ajv.compile(configSchema);

const makeNotifyMessage = (ctx: IAlertGroup) => {
  return [
    //
    `${ctx.severity} Alerting: ${ctx.name}`,
    `env: ${ctx.env}`,
    `summary: ${ctx.summary}`,
    `url: ${ctx.external_url ?? 'None'}`,
    `run_book_url: ${ctx.run_book_url ?? 'None'}`,
    `details:`,
    ...ctx.alerts.map((alert) => {
      return [
        //
        `###########`,
        `- description: ${alert.description ?? 'None'}`,
        `  status: ${alert.resolved ? 'resolved' : 'firing'}`,
        `  start_time: ${moment.utc(alert.start_time).format()}`,
        `  end_time: ${alert.end_time !== 0 ? moment.utc(alert.end_time).format() : 'still firing'}`,
        `  metric_value: ${alert.metric_value ?? 'None'}`,
        `###########`,
      ].join('\n');
    }),
  ].join('\n');
};

const ENV = process.env.ENV!;

const configFilePath = '/etc/alert-receiver/config.json';

const config$ = defer(() => bindNodeCallback(readFile)(configFilePath)).pipe(
  //
  map((x) => JSON.parse(x.toString()) as IAlertReceiverConfig),
  mergeMap((data) => {
    const isValid = validate(data);
    if (!isValid) {
      console.error(validate.errors);
    }
    return of(data);
  }),
  catchError((err) => {
    terminal.terminalInfo.status = 'ERROR';
    throw err;
  }),
  shareReplay(1),
);

const terminal = Terminal.fromNodeEnv();

const keepAliveSignal$ = new Subject<void>();

defer(() => keepAliveSignal$.pipe(first()))
  .pipe(
    //
    tap(() => {
      console.info(formatTime(Date.now()), 'WatchdogReceived');
    }),
    timeout(5 * 60_000),
    catchError((e) => {
      console.error(formatTime(Date.now()), 'WatchdogFailed', '超过 300 秒没有收到 Watchdog');
      const alert: IAlertGroup = {
        name: 'WatchdogFailed',
        // TODO: read from alertmanager
        env: ENV,
        severity: AlertSeverity.CRITICAL,
        summary: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
        run_book_url: 'https://tradelife.feishu.cn/wiki/wikcn8hGhnA1fPBztoGyh6rRzqe',
        alerts: [
          {
            start_time: Date.now(),
            end_time: 0,
            description: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
            resolved: false,
          },
        ],
      };
      return sendAlert(alert).pipe(
        // cool down for 30 minutes
        delay(30 * 60_000),
      );
    }),
    repeat(),
  )
  .subscribe();

const httpServer = express();

// ISSUE: 默认 100kb, alert-receiver 传过来的数据可能会很大，需要增加限制
httpServer.use(express.json({ limit: '128mb' }));

httpServer.post('/alertmanager', (req, res) => {
  // receive alerts from alertmanager
  console.info(formatTime(Date.now()), 'AlertReceived', JSON.stringify(req.body));
  of(req.body as IAlertManagerMessage)
    .pipe(
      // keep alive signal
      tap((msg) => {
        if (msg.commonLabels['alertname'] === 'Watchdog') {
          keepAliveSignal$.next();
        }
      }),
      filter((msg) => msg.commonLabels['alertname'] !== undefined && msg.commonLabels['severity'] !== 'none'),
      mergeMap((msg) => {
        return from(msg.alerts).pipe(
          //
          filter((item) => !!item.labels['alertname']),
          map(
            (item): IAlertInfo => ({
              metric_value: item.annotations['current_value']
                ? +item.annotations['current_value']
                : undefined,
              start_time: new Date(item.startsAt).getTime(),
              end_time: item.endsAt !== '0001-01-01T00:00:00Z' ? new Date(item.endsAt).getTime() : 0,
              description: item.annotations['description'],
              resolved: item.endsAt !== '0001-01-01T00:00:00Z',
            }),
          ),
          toArray(),
          map(
            (alerts): IAlertGroup => ({
              name: msg.commonLabels['alertname'],
              severity: (msg.commonLabels['severity'].toUpperCase() ?? 'UNKNOWN') as AlertSeverity,
              env: ENV,
              summary: msg.commonAnnotations['summary'] ?? 'None',
              run_book_url: msg.commonAnnotations['runbook_url'] ?? 'None',
              external_url: msg.externalURL,
              alerts,
            }),
          ),
        );
      }),
      mergeMap((alert) => sendAlert(alert)),
      toArray(),
    )
    .subscribe((alerts) => {
      res.status(204).end();
    });
});

httpServer.listen(3000);

function sendAlert(alert: IAlertGroup) {
  return config$.pipe(
    //
    first(),
    mergeMap((config) =>
      from(config.receivers).pipe(
        //
        filter((v) => (config.route_match[alert.severity] ?? config.route_match['UNKNOWN']) === v.route),
        tap((v) => {
          console.info(
            formatTime(Date.now()),
            'MatchingAlertsWithReceivers',
            JSON.stringify({
              alert,
              receiver: v,
            }),
          );
        }),
        mergeMap((v) =>
          terminal.request('Notify', config.notify_terminals[v.type], {
            receiver_id: v.receiver_id,
            message: makeNotifyMessage(alert),
          }),
        ),
        catchError((err) => {
          console.error(formatTime(Date.now()), 'NotifyFailed', err);
          return EMPTY;
        }),
      ),
    ),
  );
}
