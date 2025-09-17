import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import {
  catchError,
  defer,
  delay,
  filter,
  first,
  firstValueFrom,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
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
  type: string;
  receiver_id: string;
  /**
   * 接收者想要接收的最低等级的告警
   *
   * UNKNOWN > CRITICAL > ERROR > WARNING > INFO
   *
   * 例如，route 设置为 ERROR，则 ERROR, CRITICAL, UNKNOWN 级别的告警都会发送给该接收者
   */
  severity: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
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
        `  start_time: ${formatTime(alert.start_time)}`,
        `  end_time: ${alert.end_time !== 0 ? formatTime(alert.end_time) : 'still firing'}`,
        `  metric_value: ${alert.metric_value ?? 'None'}`,
        `###########`,
      ].join('\n');
    }),
  ].join('\n');
};

const ENV = process.env.ENV!;

const config$ = defer(() =>
  requestSQL<IAlertReceiverConfig[]>(terminal, `select * from alert_receiver_config where enabled = true`),
).pipe(
  //
  retry({ delay: 1_000 }),
  repeat({ delay: 10_000 }),
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
      return defer(() => sendAlert(alert)).pipe(
        // cool down for 30 minutes
        delay(30 * 60_000),
      );
    }),
    repeat(),
  )
  .subscribe();

terminal.server.provideService('/external/alertmanager/webhook', {}, async (msg) => {
  //
  const { body } = msg.req as { body: string };
  console.info(formatTime(Date.now()), 'AlertReceived', body);
  const alertMsg = JSON.parse(body) as IAlertManagerMessage;

  await firstValueFrom(
    of(alertMsg).pipe(
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
      mergeMap(sendAlert),
      toArray(),
    ),
  );
  return { res: { code: 0, message: 'OK', data: { status: 204 } } };
});

const SEVERITY_LEVEL = ['UNKNOWN', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'];

async function sendAlert(alert: IAlertGroup) {
  const config = await firstValueFrom(config$);

  const receivers = config.filter(
    (v) => SEVERITY_LEVEL.indexOf(alert.severity) <= SEVERITY_LEVEL.indexOf(v.severity),
  );
  console.info(
    formatTime(Date.now()),
    'MatchingAlertsWithReceivers',
    JSON.stringify({
      alert,
      receivers,
    }),
  );

  await Promise.allSettled(
    receivers.map((v) =>
      terminal.client.requestForResponse('Notify', {
        type: v.type,
        receiver_id: v.receiver_id,
        message: makeNotifyMessage(alert),
      }),
    ),
  );
}
