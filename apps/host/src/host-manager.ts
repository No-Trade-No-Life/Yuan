import { GlobalPrometheusRegistry, ITerminalInfo, ITerminalMessage, Terminal } from '@yuants/protocol';
import { formatTime, newError, observableToAsyncIterable, UUID, verifyMessage } from '@yuants/utils';
import { readFileSync } from 'fs';
import { createServer, IncomingMessage, RequestListener } from 'http';
import { createServer as createHttpsServer } from 'https';
import {
  BehaviorSubject,
  bindCallback,
  catchError,
  defer,
  EMPTY,
  first,
  from,
  fromEvent,
  last,
  map,
  merge,
  mergeMap,
  Observable,
  repeat,
  retry,
  Subject,
  takeUntil,
  tap,
  timeout,
} from 'rxjs';
import WebSocket from 'ws';
import { parseBodyText } from './utils/parseBodyText';

interface IHostTerminalConnection {
  terminal_id: string;
  send: (raw_message: string) => void;
  message$: Observable<string>;
  close$: Observable<any>;
  dispose: () => void;
}

interface IHost {
  host_id: string;
  addTerminalConnection: (conn: IHostTerminalConnection) => void;
  terminalInfos: Map<string, ITerminalInfo>;
  host_terminal: Terminal;
  dispose: () => void;
}

const MetricsHostManagerMessageSize = GlobalPrometheusRegistry.histogram('host_manager_message_size', '', []);
const MetricsHostManagerConnectionEstablishedCounter = GlobalPrometheusRegistry.counter(
  'host_manager_connection_established',
  '',
);
const MetricsHostManagerConnectionErrorCounter = GlobalPrometheusRegistry.counter(
  'host_manager_connection_error',
  '',
);

/**
 * @public
 */
export const createNodeJSHostManager = () => {
  const hosts: Record<string, IHost | undefined> = {};

  const createHost = (host_id: string): IHost => {
    console.info(formatTime(Date.now()), 'Host Creating', host_id);
    const mapTerminalIdToConn: Record<string, IHostTerminalConnection> = {};

    merge(
      bindCallback(process.once).call(process, 'SIGINT'),
      bindCallback(process.once).call(process, 'SIGTERM'),
    ).subscribe((sig) => {
      console.info(formatTime(Date.now()), sig, 'terminate signal received, gracefully shutting down');
      dispose();
      console.info(formatTime(Date.now()), 'GracefullyShutdown', 'Done clean up');
      process.exit(0);
    });

    const dispose = () => {
      for (const conn of Object.values(mapTerminalIdToConn)) {
        conn.dispose();
      }
      terminal.dispose();
      console.info(formatTime(Date.now()), 'Host Disposed', host_id);
    };

    const hostTerminalConnection = {
      input$: new Subject<string>(),
      output$: new Subject<string>(),
      connection$: new Subject<'connected' | 'disconnected'>(),
      isConnected$: new Subject<boolean>(),
    };

    hostTerminalConnection.connection$.next('connected');
    hostTerminalConnection.isConnected$.next(true);
    const terminal = new Terminal(
      'ws://localhost:8888', // This URL is not used because we override the connection
      {
        terminal_id: '@host',
        name: 'Host Terminal',
      },
      {
        disableTerminate: true,
        connection: hostTerminalConnection,
      },
    );

    /**
     * Host 维护的所有 Terminal 信息
     * (Host 唯一需要同步给各个终端的状态)
     */
    const terminalInfos = new Map<string, ITerminalInfo>();

    /**
     * Host 事件序列 ID
     */
    let seq_id = 0;

    interface IHostEvent {
      /**
       * 一个自增的序列号
       *
       * 终端应当订阅 HostEvent 事件流，并且保存上次收到的 seq_id
       *
       * 终端应当检查这个值是否连续的
       *
       * - 如果 seq_id 连续自增，说明事件是正常的，终端可以根据事件内容自行更新状态 (不需要重新 GetTerminalInfos)
       * - 如果不连续，说明中间有事件丢失，应该重新 GetTerminalInfos 来获取最新的状态 (seq_id 会在 GetTerminalInfos 的返回值中给出)
       */
      seq_id: number;
      /**
       * 事件类型
       * - INIT: 初始化事件，表示当前是一个新的主机
       * - TERMINAL_CHANGE: 有终端连接、断开或者状态更新
       * - 未来可能会有更多事件类型 (例如 SERVICE_CHANGE)
       */
      type: string;
      /**
       * 事件内容
       */
      payload?: unknown;
    }

    const hostEvent$ = new BehaviorSubject<IHostEvent>({ seq_id, type: 'INIT' });

    terminal.channel.publishChannel('HostEvent', { const: '' }, () => hostEvent$);

    terminal.server.provideService('GetTerminalInfos', {}, async () => {
      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            terminals: [...terminalInfos.values()],
            seq_id,
          },
        },
      };
    });

    terminal.server.provideService<ITerminalInfo>('UpdateTerminalInfo', {}, async (msg) => {
      const oldTerminalInfo = terminalInfos.get(msg.req.terminal_id);
      terminalInfos.set(msg.req.terminal_id, msg.req);

      hostEvent$.next({
        seq_id: ++seq_id,
        type: 'TERMINAL_CHANGE',
        payload: { new: msg.req, old: oldTerminalInfo },
      });

      return { res: { code: 0, message: 'OK' } };
    });

    // ISSUE: Phantom Terminal Elimination
    const sub = defer(() => terminalInfos.keys())
      .pipe(
        mergeMap((target_terminal_id) =>
          from(terminal.client.request('Ping', target_terminal_id, {})).pipe(
            last(),
            timeout(5000),
            retry(3),
            tap({
              error: (err) => {
                console.info(formatTime(Date.now()), 'Terminal ping failed', target_terminal_id, `${err}`);
                const oldTerminalInfo = terminalInfos.get(target_terminal_id);
                terminalInfos.delete(target_terminal_id);

                hostEvent$.next({
                  seq_id: ++seq_id,
                  type: 'TERMINAL_CHANGE',
                  payload: { old: oldTerminalInfo },
                });

                mapTerminalIdToConn[target_terminal_id]?.dispose();
                delete mapTerminalIdToConn[target_terminal_id];
              },
            }),
            catchError(() => EMPTY),
          ),
        ),
        repeat({ delay: 10000 }),
        retry({ delay: 1000 }),
      )
      .subscribe();
    // Clean up on Host Disconnect
    from(terminal.dispose$)
      .pipe(first())
      .subscribe(() => {
        sub.unsubscribe();
      });

    const addTerminalConnection = (conn: IHostTerminalConnection) => {
      const dispose$ = new Subject<void>();
      const { terminal_id } = conn;
      console.info(formatTime(Date.now()), 'Host', host_id, 'terminal connected', terminal_id);
      MetricsHostManagerConnectionEstablishedCounter.labels({
        host_id,
        terminal_id,
      }).inc();
      // Replace old connection if exists
      const oldTerminal = mapTerminalIdToConn[terminal_id];
      if (oldTerminal) {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal replaced', terminal_id);
        oldTerminal.dispose();
      }
      mapTerminalIdToConn[conn.terminal_id] = conn;
      // Forward Terminal Messages
      conn.message$.pipe(takeUntil(dispose$)).subscribe((raw_message) => {
        MetricsHostManagerMessageSize.labels({
          host_id,
          source_terminal_id: terminal_id,
        }).observe(raw_message.length);
        const idx = raw_message.indexOf('\n');
        const raw_headers = raw_message.slice(0, idx + 1);
        let target_terminal_id;
        try {
          const headers = JSON.parse(raw_headers);
          target_terminal_id = headers.target_terminal_id;
          // forward to target terminal if exists
          if (mapTerminalIdToConn[target_terminal_id]) {
            mapTerminalIdToConn[target_terminal_id].send(raw_message);
          } else if (!target_terminal_id || target_terminal_id === '@host') {
            // send to host terminal itself
            // no target_terminal_id or empty string means send to host
            // target_terminal_id === '@host' also means send to host (for compatibility)
            hostTerminalConnection.input$.next(raw_message);
          }
        } catch (e) {
          console.error(formatTime(Date.now()), 'InvalidHeader', raw_headers);
          return;
        }
      });
      // Clean up on Terminal Disconnect
      conn.close$.subscribe(() => {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal disconnected', conn.terminal_id);

        const oldTerminalInfo = terminalInfos.get(conn.terminal_id);

        hostEvent$.next({
          seq_id: ++seq_id,
          type: 'TERMINAL_CHANGE',
          payload: { old: oldTerminalInfo },
        });

        terminalInfos.delete(conn.terminal_id);
        delete mapTerminalIdToConn[conn.terminal_id];

        conn.dispose();
        dispose$.next();
      });
    };

    // Add the host terminal itself as a special terminal with terminal_id = '@host'
    addTerminalConnection({
      terminal_id: '@host',
      send: (raw_message: string) => {
        hostTerminalConnection.input$.next(raw_message);
      },
      message$: hostTerminalConnection.output$,
      close$: EMPTY, // Never close actively
      dispose: () => {
        hostTerminalConnection.connection$.next('disconnected');
        hostTerminalConnection.isConnected$.next(false);
        terminal.dispose();
      },
    });

    return {
      host_id,
      host_terminal: terminal,
      addTerminalConnection,
      terminalInfos,
      dispose,
    };
  };

  const resolveHost = (request: IncomingMessage) => {
    const url = new URL(request.url || '', 'http://localhost:8888');
    const params = url.searchParams;
    const headers = request.headers;

    console.info(formatTime(Date.now()), 'ResolveHost', url.toString(), JSON.stringify(headers));

    if (headers['authorization']) {
      const auth = headers['authorization'];

      if (auth.startsWith('Bearer ')) {
        const token = auth.slice('Bearer '.length);
        url.searchParams.set('host_token', token);
      }
    }

    if (headers['host_token']) {
      url.searchParams.set('host_token', headers['host_token'] as string);
    }

    const terminal_id = params.get('terminal_id') || UUID();

    let host_id: string;
    try {
      if (process.env.HOST_TOKEN) {
        if (process.env.HOST_TOKEN !== url.searchParams.get('host_token'))
          throw new Error('InvalidHostToken');
      }
      if (process.env.MULTI_TENANCY === 'ED25519') {
        const public_key = url.searchParams.get('public_key')!;
        const signature = url.searchParams.get('signature')!;
        if (!public_key) throw new Error('public_key is required');
        if (!signature) throw new Error('signature is required');
        if (!verifyMessage('', signature, public_key)) throw new Error('signature is invalid');
        host_id = public_key;
      }
      host_id = 'main';
    } catch (err) {
      MetricsHostManagerConnectionErrorCounter.add(1);
      console.info(formatTime(Date.now()), 'Auth Failed', url.toString(), `${err}`);
      return null;
    }

    // create host if not exists
    const host = (hosts[host_id] ??= createHost(host_id));
    return { host, terminal_id };
  };

  const handleRequest: RequestListener = async (req, res): Promise<void> => {
    try {
      console.info(formatTime(Date.now()), 'HTTP Request', req.method, req.url);
      const theUrl = new URL(req.url || '', 'http://localhost:8888');
      const x = resolveHost(req);
      if (!x) {
        MetricsHostManagerConnectionErrorCounter.add(1);
        res.writeHead(401);
        res.end('Unauthorized: ' + req.url);
        return;
      }

      // 内部 API 请求 (POST /request)，路由到内部服务
      if (theUrl.pathname === '/request') {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
          });
          res.end();
          return;
        }
        if (req.method === 'POST') {
          const _reqMsg = await parseBodyText(req);
          const reqMsg = JSON.parse(_reqMsg) as ITerminalMessage;
          if (!reqMsg.method) throw newError('INVALID_REQUEST', { reason: 'method is required' });
          if (!reqMsg.req) throw newError('INVALID_REQUEST', { reason: 'req is required' });

          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });

          // 按照 NDJSON 格式封装请求消息
          for await (const msg of observableToAsyncIterable(
            x.host.host_terminal.client.requestService(reqMsg.method, reqMsg.req),
          )) {
            res.write(JSON.stringify(msg) + '\n');
          }
          res.end();

          return;
        }
        return;
      }

      // 外部请求 (/external/) 格式由外部系统决定，直接转发给 Host 处理 (例如 WebHook)
      if (theUrl.pathname.startsWith('/external/')) {
        const reqBody = await parseBodyText(req);

        const reqJson = {
          method: req.method,
          url: req.url,
          pathname: theUrl.pathname,
          headers: req.headers,
          body: reqBody,
          host_id: x?.host.host_id,
        };

        const response = await x!.host.host_terminal.client.requestForResponse(reqJson.pathname, reqJson);
        const { status = 200, headers, body } = response.data as any;
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            if (v) res.setHeader(k, v as string);
          }
        }
        res.writeHead(status);
        res.end(body);

        return;
      }
    } catch (err) {
      res.writeHead(500);
      res.end(`Internal Server Error: ${err}`);
    }
  };

  const servers = [
    ...[createServer().listen(process.env.PORT ? Number(process.env.PORT) : 8888)],
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? [
          createHttpsServer({
            key: readFileSync(process.env.SSL_KEY_PATH),
            cert: readFileSync(process.env.SSL_CERT_PATH),
          }).listen(process.env.SSL_PORT ? Number(process.env.SSL_PORT) : 18888),
        ]
      : []),
  ];

  for (const server of servers) {
    server.addListener('request', handleRequest);

    const wss = new WebSocket.Server({
      server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024, // Size (in bytes) below which messages
        // should not be compressed if context takeover is disabled.
      },
    });

    wss.on('error', (err) => {
      console.info(formatTime(Date.now()), 'WebSocketServerError', err);
    });

    wss.on('connection', (ws, request) => {
      const x = resolveHost(request);
      if (!x) {
        MetricsHostManagerConnectionErrorCounter.add(1);
        ws.close(1008, 'Authentication failed: Invalid or expired token');
        return;
      }

      ws.on('error', (err) => {
        console.info(formatTime(Date.now()), 'WebSocketError', x?.host.host_id, x?.terminal_id, err);
      });

      const { host, terminal_id } = x;
      const conn: IHostTerminalConnection = {
        terminal_id,
        send: (raw_message: string) => {
          ws.send(raw_message);
        },
        message$: (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).pipe(
          map((origin) => origin.data.toString()),
        ),
        close$: fromEvent(ws, 'close'),
        dispose: () => ws.terminate(),
      };
      host.addTerminalConnection(conn);
    });
  }
};
