import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { catchError, defer, EMPTY, filter, interval, Observable, Subscription, tap, timeout } from 'rxjs';
import { IWSOrderBook } from './public-data/market-order';

const MetricsWebSocketConnectionsGauge = GlobalPrometheusRegistry.gauge(
  'okx_websocket_connections',
  'Number of active OKX WebSocket connections',
);

const MetricsWebSocketChannelGauge = GlobalPrometheusRegistry.gauge(
  'okx_websocket_channel',
  'Number of OKX WebSocket channels subscribed',
);

type ConnectStatus = 'connecting' | 'connected' | 'closed' | 'reconnecting';
const terminal = Terminal.fromNodeEnv();

class OKXWsClient {
  private static readonly pool: {
    path: string;
    client: OKXWsClient;
    requests: number;
    isFull: boolean;
  }[] = [];

  // ISSUE: 连接限制：3 次/秒 (基于IP)
  // https://www.okx.com/docs-v5/zh/#overview-websocket-connect
  // 每个连接 对于 订阅/取消订阅/登录 请求的总次数限制为 480 次/小时
  static GetWsClient(path: string): OKXWsClient {
    const existing = OKXWsClient.pool.find((item) => item.path === path && !item.isFull);
    if (existing && !existing.client.isClosed()) {
      existing.requests++;
      if (existing.requests >= 480) {
        existing.isFull = true;
      }
      return existing.client;
    }

    const client = existing?.client?.isClosed() ? existing.client.revive() : new OKXWsClient(path);
    if (existing) {
      existing.client = client;
      existing.requests = 1;
      existing.isFull = false;
    } else {
      OKXWsClient.pool.push({ path, client, requests: 1, isFull: false });
    }
    return client;
  }

  private readonly baseURL: string = `wss://ws.okx.com:8443`;
  private readonly path: string;
  private ws!: WebSocket;
  private connectStatus: ConnectStatus = 'closed';
  private keepAlive?: Subscription;
  private readonly subscriptions = new Map<
    string,
    {
      channel: string;
      instId?: string;
    }
  >();
  private readonly handlers: Record<string, Function> = {};
  private readonly connectionListeners: Record<'error' | 'close', Set<EventListener>> = {
    error: new Set(),
    close: new Set(),
  };

  private readonly handleOpen = () => {
    this.connectStatus = 'connected';
    console.info(formatTime(Date.now()), '✅ WS connected');
    for (const { channel, instId } of this.subscriptions.values()) {
      this.sendSubscribeMessage(channel, instId);
    }
  };

  private readonly handleMessage = (raw: MessageEvent) => {
    if (raw.data === 'pong') {
      return;
    }
    const msg = JSON.parse(raw.data);
    if (msg.arg?.channel) {
      const channelId = encodePath(msg.arg.channel, msg.arg.instId);
      const data = msg.data;
      const handler = this.handlers[channelId];
      if (data && handler) {
        handler(data, msg.arg);
      }
    } else if (msg.event) {
      console.info(formatTime(Date.now()), 'Event:', msg);
    }
  };

  private readonly handleError = (event: Event) => {
    console.error(formatTime(Date.now()), '❌ WS error', event);
  };

  private readonly handleClose = (event: CloseEvent) => {
    console.error(formatTime(Date.now()), '❌ WS closed', event);
    MetricsWebSocketConnectionsGauge.labels({ path: this.path }).dec();

    const closedSocket = event.target as WebSocket;
    if (closedSocket !== this.ws) {
      return;
    }

    if (this.connectStatus === 'reconnecting') {
      return;
    }

    this.connectStatus = 'closed';

    if (this.subscriptions.size === 0) {
      return;
    }

    this.connectStatus = 'reconnecting';
    setTimeout(() => {
      if (this.connectStatus === 'connecting' || this.connectStatus === 'connected') {
        return;
      }
      if (this.subscriptions.size === 0) {
        this.connectStatus = 'closed';
        return;
      }
      this.initSocket();
    }, 1000);
  };

  constructor(path: string) {
    this.path = path;
    this.initSocket();
    this.startKeepAlive();
  }

  private revive(): OKXWsClient {
    this.initSocket();
    this.startKeepAlive();
    return this;
  }

  private initSocket() {
    this.connectStatus = 'connecting';
    this.ws = new WebSocket(`${this.baseURL}/${this.path}`);
    MetricsWebSocketConnectionsGauge.labels({ path: this.path, terminal_id: terminal.terminal_id }).inc();

    this.ws.addEventListener('open', this.handleOpen);
    this.ws.addEventListener('message', this.handleMessage);
    this.ws.addEventListener('error', this.handleError);
    this.ws.addEventListener('close', this.handleClose);

    for (const listener of this.connectionListeners.error) {
      this.ws.addEventListener('error', listener);
    }
    for (const listener of this.connectionListeners.close) {
      this.ws.addEventListener('close', listener);
    }
  }

  private startKeepAlive() {
    if (this.keepAlive && !this.keepAlive.closed) {
      return;
    }
    this.keepAlive = interval(25_000)
      .pipe(
        tap(() => {
          if (this.connectStatus === 'connected') {
            this.ws.send('ping');
          }
        }),
      )
      .subscribe();
  }

  private stopKeepAlive() {
    if (this.keepAlive && !this.keepAlive.closed) {
      this.keepAlive.unsubscribe();
    }
  }

  private isClosed() {
    return this.ws?.readyState === WebSocket.CLOSING || this.ws?.readyState === WebSocket.CLOSED;
  }

  private sendSubscribeMessage(channel: string, instId?: string) {
    const message = {
      op: 'subscribe',
      args: [{ channel, instId }],
    };
    this.ws.send(JSON.stringify(message));
    const channelId = encodePath(channel, instId);
    console.info(formatTime(Date.now()), `📩 Sent subscribe for ${channelId}`);
  }

  private sendUnsubscribeMessage(channel: string, instId?: string) {
    const message = {
      op: 'unsubscribe',
      args: [{ channel, instId }],
    };
    this.ws.send(JSON.stringify(message));
    const channelId = encodePath(channel, instId);
    console.info(formatTime(Date.now()), `📩 Sent unsubscribe for ${channelId}`);
  }

  addConnectionListener(type: 'error' | 'close', listener: EventListener): () => void {
    this.connectionListeners[type].add(listener);
    this.ws.addEventListener(type, listener);
    return () => {
      this.connectionListeners[type].delete(listener);
      this.ws.removeEventListener(type, listener);
    };
  }

  subscribe(channel: string, instId?: string, handler?: Function) {
    const channelId = encodePath(channel, instId);
    if (this.subscriptions.has(channelId)) {
      console.info(formatTime(Date.now()), `⚠️ Already subscribed: ${channelId}`);
      return;
    }

    this.subscriptions.set(channelId, { channel, instId });
    MetricsWebSocketChannelGauge.labels({ channel, terminal_id: terminal.terminal_id }).inc();

    if (handler) {
      this.handlers[channelId] = handler;
    }

    this.startKeepAlive();

    if (this.connectStatus === 'connected') {
      this.sendSubscribeMessage(channel, instId);
    } else if (this.isClosed()) {
      this.initSocket();
    } else {
      console.info(formatTime(Date.now()), `📩 Queued subscribe for ${channelId} waiting for connection`);
    }
  }

  unsubscribe(channel: string, instId?: string) {
    const channelId = encodePath(channel, instId);
    if (!this.subscriptions.has(channelId)) return;

    if (this.connectStatus === 'connected') {
      this.sendUnsubscribeMessage(channel, instId);
    }
    this.subscriptions.delete(channelId);
    MetricsWebSocketChannelGauge.labels({ channel }).dec();
    delete this.handlers[channelId];

    if (this.subscriptions.size === 0) {
      this.stopKeepAlive();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }
  }
}

const fromWsChannelAndInstId = <T>(path: string, channel: string, instId: string) =>
  defer(
    () =>
      new Observable<T>((subscriber) => {
        const client = OKXWsClient.GetWsClient(path);
        client.subscribe(channel, instId, (data: T) => {
          subscriber.next(data);
        });
        const removeError = client.addConnectionListener('error', (err) => {
          subscriber.error(err);
        });
        const removeClose = client.addConnectionListener('close', () => {
          subscriber.error('WS Connection Closed');
        });
        subscriber.add(() => {
          removeError();
          removeClose();
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
  fromWsChannelAndInstId<
    {
      instId: string;
      last: string;
      askPx: string;
      bidPx: string;
      askSz: string;
      bidSz: string;
    }[]
  >('ws/v5/public', 'tickers', instId).pipe(
    //
    filter((data) => data.length > 0),
  );

export const useOpenInterest = (instId: string) =>
  fromWsChannelAndInstId<
    {
      instId: string;
      oi: string; // open interest
    }[]
  >('ws/v5/public', 'open-interest', instId).pipe(
    //
    filter((data) => data.length > 0),
  );

export const useOHLC = (candleType: string, instId: string) =>
  fromWsChannelAndInstId<string[][]>('ws/v5/business', candleType, instId).pipe(
    //
    filter((data) => data.length > 0),
  );

export const useMarketBooks = (
  channel: 'books' | 'books5' | 'bbo-tbt' | 'books-l2-tbt' | 'books50-l2-tbt',
  instId: string,
) =>
  fromWsChannelAndInstId<IWSOrderBook[]>('ws/v5/public', channel, instId).pipe(
    //
    filter((data) => data.length > 0),
  );

export const useFundingRate = (instId: string) =>
  fromWsChannelAndInstId<
    {
      fundingRate: string;
      fundingTime: string;
      instId: string;
      instType: string;
      method: string;
      maxFundingRate: string;
      minFundingRate: string;
      nextFundingRate: string;
      nextFundingTime: string;
      premium: string;
      settFundingRate: string;
      settState: string;
      ts: string;
    }[]
  >('ws/v5/public', 'funding-rate', instId).pipe(
    //
    filter((data) => data.length > 0),
  );
