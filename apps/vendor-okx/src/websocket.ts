import { encodePath, formatTime } from '@yuants/utils';
// import WebSocket from 'ws';

class OKXWsClient {
  ws: WebSocket;
  connected: boolean = false;
  subscriptions: Set<string>;
  handlers: Record<string, Function>;
  pendingSub: string[];
  constructor(url: string) {
    // this.instId = instId;
    this.ws = new WebSocket(url);
    this.pendingSub = [];
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
    this.subscriptions = new Set();
    this.handlers = {}; // key: channel, value: callback
  }

  // 处理消息
  handleMessage(raw: any) {
    const msg = JSON.parse(raw.data);
    if (msg.arg?.channel) {
      const channelId = encodePath(msg.arg.channel, msg.arg.instId);
      const data = msg.data?.[0];
      if (data && this.handlers[channelId]) {
        this.handlers[channelId](data, msg.arg);
      }
    } else if (msg.event) {
      console.info('Event:', msg);
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
    delete this.handlers[channelId];
    console.info(`📩 Sent unsubscribe for ${channelId}`);
  }
}

export const okxBusinessWsClient = new OKXWsClient('wss://wspap.okx.com:8443/ws/v5/business');
