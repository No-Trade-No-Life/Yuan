import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { interval, Subscription, tap } from 'rxjs';
// import WebSocket from 'ws';

export class OKXWsClient {
  ws: WebSocket | undefined;
  connected: boolean = false;
  subscriptions: Set<string>;
  handlers: Record<string, Function>;
  pendingSub: string[];
  keepAlive: Subscription | undefined;
  timeout: number;
  baseURL: string = `wss://ws.okx.com:8443`;
  url: string;

  heartbeatTimer: NodeJS.Timeout | undefined;
  constructor(path: string, timeout = 30000) {
    this.url = `${this.baseURL}/${path}`;
    this.pendingSub = [];
    this.connect();
    // this.ws = new WebSocket(this.url);
    // this.keepAlive = interval(25000)
    //   .pipe(
    //     tap(() => {
    //       if (this.connected) {
    //         this.ws.send('ping');
    //       }
    //     }),
    //   )
    //   .subscribe();
    // this.addEventListener();
    this.timeout = timeout;
    this.subscriptions = new Set();
    this.handlers = {}; // key: channel, value: callback
  }
  connect() {
    this.ws = new WebSocket(this.url);
    this.keepAlive = interval(25000)
      .pipe(
        tap(() => {
          if (this.connected) {
            this.ws!.send('ping');
          }
        }),
      )
      .subscribe();
    this.addEventListener();
  }

  onClose() {
    this.connected = false;
    this.keepAlive?.unsubscribe();
  }
  addEventListener() {
    if (this.ws) {
      this.ws.addEventListener('open', () => {
        this.connected = true;
        console.info(formatTime(Date.now()), '✅ WS connected');
        while (this.pendingSub.length > 0) {
          const msg = this.pendingSub.shift();
          if (msg) {
            this.ws?.send(msg);
            console.info(formatTime(Date.now()), `📩 Sent subscribe for ${msg}`);
          }
        }
        this.subscriptions.forEach((channelId) => {
          const [channel, instId] = decodePath(channelId);

          const subMsg = {
            op: 'subscribe',
            args: [{ channel, instId }],
          };
          this.ws?.send(JSON.stringify(subMsg));
        });
        this.resetHeartbeat();
      });

      this.ws.addEventListener('message', (raw) => this.handleMessage(raw));
      this.ws.addEventListener('error', (raw) => {
        console.error(formatTime(Date.now()), '❌ WS error', raw);
        this.onClose();
        this.ws?.close();
        // this.connect();
      });
      this.ws.addEventListener('close', (event) => {
        console.error(formatTime(Date.now()), '❌ WS closed', event);
        this.onClose();
        this.connect();
      });
    }
  }

  // 处理消息
  handleMessage(raw: any) {
    this.resetHeartbeat();
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

  resetHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      console.warn(`⏱️ No data for ${this.timeout / 1000}s, reconnecting...`);
      this.onClose();
      this.ws?.close();
    }, this.timeout);
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
      this.ws?.send(JSON.stringify(subMsg));
      console.info(formatTime(Date.now()), `📩 Sent subscribe for ${channelId}`);
    } else {
      this.pendingSub.push(JSON.stringify(subMsg));
      console.info(formatTime(Date.now()), `📩 add subscribe for ${channelId} to pending list`);
    }
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

    this.ws?.send(JSON.stringify(unSubMsg));
    this.subscriptions.delete(channelId);
    if (this.subscriptions.size === 0) {
      this.keepAlive?.unsubscribe();
    }
    delete this.handlers[channelId];
    console.info(formatTime(Date.now()), `📩 Sent unsubscribe for ${channelId}`);
  }
}
