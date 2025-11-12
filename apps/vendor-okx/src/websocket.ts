import { PromRegistry, Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { catchError, defer, EMPTY, interval, Observable, Subscription, tap, timeout } from 'rxjs';

const MetricsWebSocketConnectionsGauge = PromRegistry.create(
  'gauge',
  'okx_websocket_connections',
  'Number of active OKX WebSocket connections',
);

const MetricsWebSocketChannelGauge = PromRegistry.create(
  'gauge',
  'okx_websocket_channel',
  'Number of OKX WebSocket channels subscribed',
);

const terminal = Terminal.fromNodeEnv();

class OKXWsClient {
  ws: WebSocket;
  connected: boolean = false;
  subscriptions: Set<string>;
  handlers: Record<string, Function>;
  pendingSub: string[];
  keepAlive: Subscription;

  baseURL: string = `wss://ws.okx.com:8443`;
  constructor(path: string) {
    // this.instId = instId;
    this.ws = new WebSocket(`${this.baseURL}/${path}`);

    MetricsWebSocketConnectionsGauge.inc({ path, terminal_id: terminal.terminal_id });

    this.pendingSub = [];
    this.keepAlive = interval(25000)
      .pipe(
        tap(() => {
          if (this.connected) {
            this.ws.send('ping');
          }
        }),
      )
      .subscribe();
    // this.ws.
    this.ws.addEventListener('open', () => {
      this.connected = true;
      console.info(formatTime(Date.now()), '✅ WS connected');
      while (this.pendingSub.length > 0) {
        const msg = this.pendingSub.shift();
        if (msg) {
          this.ws.send(msg);
          console.info(formatTime(Date.now()), `📩 Sent subscribe for ${msg}`);
        }
      }
    });

    this.ws.addEventListener('message', (raw) => this.handleMessage(raw));
    this.ws.addEventListener('error', (raw) => {
      console.error(formatTime(Date.now()), '❌ WS error', raw);
    });
    this.ws.addEventListener('close', (event) => {
      console.error(formatTime(Date.now()), '❌ WS closed', event);

      MetricsWebSocketConnectionsGauge.dec({ path });
    });
    this.subscriptions = new Set();
    this.handlers = {}; // key: channel, value: callback
  }

  // 处理消息
  handleMessage(raw: { data: string }) {
    if (raw.data === 'pong') {
      return;
    }
    const msg = JSON.parse(raw.data);
    if (msg.arg?.channel) {
      const channelId = encodePath(msg.arg.channel, msg.arg.instId);
      const data = msg.data?.[0];
      if (data && this.handlers[channelId]) {
        this.handlers[channelId](data, msg.arg);
      }
    } else if (msg.event) {
      console.info(formatTime(Date.now()), 'Event:', msg);
    }
  }

  // 调用订阅
  subscribe(channel: string, instId?: string, handler?: Function) {
    const channelId = encodePath(channel, instId);
    if (this.subscriptions.has(channelId)) {
      console.info(formatTime(Date.now()), `⚠️ Already subscribed: ${channelId}`);
      return;
    }

    const subMsg = {
      op: 'subscribe',
      args: [{ channel, instId }],
    };

    if (this.connected) {
      this.ws.send(JSON.stringify(subMsg));
      console.info(formatTime(Date.now()), `📩 Sent subscribe for ${channelId}`);
    } else {
      this.pendingSub.push(JSON.stringify(subMsg));
      console.info(formatTime(Date.now()), `📩 add subscribe for ${channelId} to pending list`);
    }
    MetricsWebSocketChannelGauge.inc({ channel, terminal_id: terminal.terminal_id });
    this.subscriptions.add(channelId);
    if (handler) {
      this.handlers[channelId] = handler;
    }
  }

  // 取消订阅
  unsubscribe(channel: string, instId?: string) {
    const channelId = encodePath(channel, instId);
    if (!this.subscriptions.has(channelId)) return;

    const unSubMsg = {
      op: 'unsubscribe',
      args: [{ channel, instId }],
    };

    this.ws.send(JSON.stringify(unSubMsg));
    this.subscriptions.delete(channelId);
    if (this.subscriptions.size === 0) {
      this.keepAlive.unsubscribe();
    }
    MetricsWebSocketChannelGauge.dec({ channel });
    delete this.handlers[channelId];
    console.info(formatTime(Date.now()), `📩 Sent unsubscribe for ${channelId}`);
  }
}

const wsPool: {
  path: string;
  client: OKXWsClient;
  requests: number;
  isFull: boolean;
}[] = [];

// ISSUE: 连接限制：3 次/秒 (基于IP)
//
// https://www.okx.com/docs-v5/zh/#overview-websocket-connect
//
// 当订阅公有频道时，使用公有服务的地址；当订阅私有频道时，使用私有服务的地址
//
// 请求限制：
//
// 每个连接 对于 订阅/取消订阅/登录 请求的总次数限制为 480 次/小时
const getWsClient = (path: string) => {
  const existing = wsPool.find((item) => item.path === path && !item.isFull);
  if (existing) {
    existing.requests++;
    if (existing.requests >= 480) {
      existing.isFull = true;
    }
    return existing.client;
  }
  const newClient = new OKXWsClient(path);
  wsPool.push({ path, client: newClient, requests: 1, isFull: false });
  return newClient;
};

const fromWsChannelAndInstId = <T>(path: string, channel: string, instId: string) =>
  defer(
    () =>
      new Observable<T>((subscriber) => {
        const client = getWsClient(path);
        client.subscribe(channel, instId, (data: T) => {
          subscriber.next(data);
        });
        client.ws.addEventListener('error', (err) => {
          subscriber.error(err);
        });
        client.ws.addEventListener('close', () => {
          subscriber.error('WS Connection Closed');
        });
        subscriber.add(() => {
          client.unsubscribe(channel, instId);
        });
      }),
  ).pipe(
    // 防止单个连接断开导致数据流关闭
    timeout(60_000),
    tap({
      error: (err) => {
        console.info(formatTime(Date.now()), 'WS_SUBSCRIBE_ERROR', channel, instId, err);
      },
    }),
    // 暂时不太确定是否能支持 retry
    // retry({ delay: 1000 }),
    catchError(() => EMPTY),
  );

export const useTicker = (instId: string) =>
  fromWsChannelAndInstId<{
    instId: string;
    last: string;
    askPx: string;
    bidPx: string;
    askSz: string;
    bidSz: string;
  }>('ws/v5/public', 'tickers', instId);

export const useOpenInterest = (instId: string) =>
  fromWsChannelAndInstId<{
    instId: string;
    oi: string; // open interest
  }>('ws/v5/public', 'open-interest', instId);

export const useOHLC = (candleType: string, instId: string) =>
  fromWsChannelAndInstId<string[]>('ws/v5/business', candleType, instId);
