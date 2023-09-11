import { Terminal } from '@yuants/protocol';
import Ajv from 'ajv';
import express from 'express';
import { readFile } from 'fs';
import { JSONSchema7 } from 'json-schema';
import moment from 'moment-timezone';
import {
  bindNodeCallback,
  catchError,
  defer,
  EMPTY,
  filter,
  first,
  from,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
  Subject,
  tap,
  timeout,
  TimeoutError,
  toArray,
} from 'rxjs';

/// Alert manager 消息
interface IAlertManagerMessage {
  receiver: string;
  status: string;
  alerts: IAlert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts: number;
}

interface IAlert {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

interface IAlertInfo {
  /** Alert name */
  name: string;
  /** Severity */
  severity: AlertSeverity;
  /** current value of the alerting metrics */
  metric_value?: number;
  /** link */
  metric_url?: string;
  /** alert start time */
  start_time_in_us: number;
  /** alert end time */
  end_time_in_us: number;
  /** description of alerting */
  description?: string;
  /** run book URL */
  run_book_url?: string;
  /** summary */
  summary: string;
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

const makeNotifyMessage = (ctx: IAlertInfo) => {
  // TODO(wsy): i18n
  return [
    //
    `[${ctx.end_time_in_us === 0 ? 'firing' : 'resolved'}] ${ctx.severity} 告警：${ctx.name}`,
    `告警环境: ${ENV}`,
    `告警状况：${ctx.summary}`,
    `告警规则描述：${ctx.description ? ctx.description : '无'}`,
    `告警规则文档：${ctx.run_book_url ? ctx.run_book_url : '无'}`,
    `开始时间：${moment.utc(ctx.start_time_in_us / 1000).format()}`,
    `结束时间: ${ctx.end_time_in_us !== 0 ? moment.utc(ctx.end_time_in_us / 1000).format() : '还未结束'}`,
    `告警指标当前值：${ctx.metric_value ? ctx.metric_value : '无'}`,
    `告警指标链接：${ctx.metric_url ? ctx.metric_url : '无'}`,
  ].join('\n');
};

const HV_URL = process.env.HV_URL!;

const TERMINAL_ID = process.env.TERMINAL_ID || `webhook-receiver/alert`;

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
    term.terminalInfo.status = 'ERROR';
    throw err;
  }),
  shareReplay(1),
);

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Webhook Receiver Alert',
  status: 'OK',
});

const keepAliveSignal$ = new Subject();

keepAliveSignal$
  .pipe(
    //
    tap(() => {
      console.info(new Date(), 'WatchdogReceived');
    }),
    timeout(5 * 60_000),
    catchError((e) => {
      if (e instanceof TimeoutError) {
        console.error(new Date(), 'WatchdogFailed', '超过 300 秒没有收到 Watchdog');
        const alert: IAlertInfo = {
          name: 'WatchdogFailed',
          severity: AlertSeverity.CRITICAL,
          start_time_in_us: Date.now(),
          end_time_in_us: 0,
          summary: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
          run_book_url: 'https://tradelife.feishu.cn/wiki/wikcn8hGhnA1fPBztoGyh6rRzqe',
          description: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
        };
        return sendAlert(alert);
      }
      throw e;
    }),
  )
  .subscribe();

const httpServer = express();

// ISSUE: 默认 100kb, alert-receiver 传过来的数据可能会很大，需要增加限制
httpServer.use(express.json({ limit: '128mb' }));

httpServer.post('/alertmanager', (req, res) => {
  // receive alerts from alertmanager
  console.info(new Date(), 'Alert received', JSON.stringify(req.body));
  of(req.body as IAlertManagerMessage)
    .pipe(
      //
      mergeMap((msg) =>
        from(msg.alerts).pipe(
          //
          filter((alert) => !!alert.labels['alertname']),
          mergeMap((alert): Observable<IAlertInfo> => {
            if (alert.labels['alertname'] === 'Watchdog') {
              keepAliveSignal$.next(undefined);
              return EMPTY;
            }
            return of({
              name: alert.labels['alertname'],
              // resolved 属于 INFO
              severity:
                alert.endsAt === '0001-01-01T00:00:00Z'
                  ? ((alert.labels['severity'].toUpperCase() ?? 'UNKNOWN') as AlertSeverity)
                  : AlertSeverity.INFO,
              metric_value: alert.annotations['current_value']
                ? +alert.annotations['current_value']
                : undefined,
              metric_url: alert.generatorURL,
              start_time_in_us: new Date(alert.startsAt).getTime() * 1000,
              end_time_in_us:
                alert.endsAt !== '0001-01-01T00:00:00Z' ? new Date(alert.endsAt).getTime() * 1000 : 0,
              summary: `${alert.annotations['summary'] ?? ''} ${JSON.stringify(alert.labels)}`,
              run_book_url: alert.annotations['runbook_url'],
              description: alert.annotations['description'],
            });
          }),
        ),
      ),
      mergeMap((alert) => sendAlert(alert)),
      toArray(),
    )
    .subscribe((alerts) => {
      res.status(204).end();
    });
});

httpServer.listen(3000);

function sendAlert(alert: IAlertInfo) {
  return config$.pipe(
    //
    first(),
    mergeMap((config) =>
      from(config.receivers).pipe(
        //
        tap((v) => {
          console.info(
            new Date(),
            'MatchingAlertsWithReceivers',
            JSON.stringify({
              alert,
              receiver: v,
            }),
          );
        }),
        mergeMap((v) => {
          if ((config.route_match[alert.severity] ?? config.route_match['UNKNOWN']) === v.route) {
            return term.request('Notify', config.notify_terminals[v.type], {
              receiver_id: v.receiver_id,
              message: makeNotifyMessage(alert),
            });
          }
          return EMPTY;
        }),
        catchError((err) => {
          console.error(new Date(), 'NotifyFailed', err);
          return EMPTY;
        }),
      ),
    ),
  );
}
