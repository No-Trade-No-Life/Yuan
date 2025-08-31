import { ITerminalInfo, MetricsMeterProvider, Terminal } from '@yuants/protocol';
import { formatTime, UUID } from '@yuants/utils';
import { createServer, IncomingMessage } from 'http';
import {
  bindCallback,
  catchError,
  defer,
  EMPTY,
  first,
  from,
  fromEvent,
  interval,
  last,
  map,
  merge,
  mergeMap,
  Observable,
  repeat,
  retry,
  shareReplay,
  Subject,
  tap,
  timeout,
} from 'rxjs';
import WebSocket from 'ws';

const meter = MetricsMeterProvider.getMeter('yuants.host-manager');

/**
 * @public
 */
export interface IHostManagerConfig {
  /**
   * rules for mapping host_url to host_id.
   *
   * same host_id should connect to the same host.
   *
   * terminals with different host_id should not be connected to the same host.
   *
   * throw error if host_url is invalid (e.g. Unauthorized)
   */
  mapHostUrlToHostId: (host_url: string) => string;
}

/**
 * @public
 */
export interface IHostManger {
  //
  hosts: Record<string, IHost | undefined>;
  dispose: () => void;
}

/**
 * @public
 */
export interface IHost {
  mapTerminalIdToSocket: Record<string, WebSocket.WebSocket>;
  terminalInfos: Map<string, ITerminalInfo>;
  host_id: string;
  host_terminal: Terminal;
  dispose: () => void;
}

const MetricsHostManagerMessageSize = meter.createHistogram('host_manager_message_size');
const MetricsHostManagerConnectionEstablishedCounter = meter.createCounter(
  'host_manager_connection_established',
);
const MetricsHostManagerConnectionErrorCounter = meter.createCounter('host_manager_connection_error');

/**
 * @public
 */
export const createNodeJSHostManager = (config: IHostManagerConfig): IHostManger => {
  const internal_host_key = UUID();
  const hosts: Record<string, IHost | undefined> = {};

  const createHost = (host_id: string): IHost => {
    console.info(formatTime(Date.now()), 'Host Creating', host_id);
    const mapTerminalIdToSocket: Record<string, WebSocket.WebSocket> = {};

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
      for (const ws of Object.values(mapTerminalIdToSocket)) {
        ws.close();
      }
      terminal.dispose();
      console.info(formatTime(Date.now()), 'Host Disposed', host_id);
    };

    const HOST_URL = `ws://localhost:8888?has_header=true&host_id=${host_id}&internal_host_key=${internal_host_key}`;
    const terminal = new Terminal(
      HOST_URL,
      {
        terminal_id: '@host',
        name: 'Host Terminal',
      },
      { disableTerminate: true },
    );

    const terminalInfos = new Map<string, ITerminalInfo>();

    const listTerminalsMessage$ = interval(1000).pipe(
      map(() => ({ res: { code: 0, message: 'OK', data: [...terminalInfos.values()] } })),
      shareReplay(1),
    );

    const terminalInfo$ = new Subject<ITerminalInfo>();
    const terminalInfoChangeEvent$ = new Subject<{ new?: ITerminalInfo; old?: ITerminalInfo }>();

    terminal.channel.publishChannel('TerminalInfo', { const: '' }, () => terminalInfo$);
    terminal.channel.publishChannel('TerminalInfoChangeEvent', { const: '' }, () => terminalInfoChangeEvent$);

    terminal.provideService('ListTerminals', {}, () => listTerminalsMessage$.pipe(first()));

    terminal.provideService('UpdateTerminalInfo', {}, async (msg) => {
      const oldTerminalInfo = terminalInfos.get(msg.req.terminal_id);
      terminalInfos.set(msg.req.terminal_id, msg.req);
      terminalInfo$.next(msg.req);
      terminalInfoChangeEvent$.next({ new: msg.req, old: oldTerminalInfo });
      return { res: { code: 0, message: 'OK' } };
    });

    // ISSUE: Phantom Terminal Elimination
    const sub = defer(() => terminalInfos.keys())
      .pipe(
        mergeMap((target_terminal_id) =>
          from(terminal.request('Ping', target_terminal_id, {})).pipe(
            last(),
            timeout(5000),
            retry(3),
            tap({
              error: (err) => {
                console.info(formatTime(Date.now()), 'Terminal ping failed', target_terminal_id, `${err}`);
                const oldTerminalInfo = terminalInfos.get(target_terminal_id);
                terminalInfos.delete(target_terminal_id);
                terminalInfoChangeEvent$.next({ old: oldTerminalInfo });
                mapTerminalIdToSocket[target_terminal_id]?.terminate();
                delete mapTerminalIdToSocket[target_terminal_id];
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

    return {
      host_id,
      host_terminal: terminal,
      mapTerminalIdToSocket,
      terminalInfos,
      dispose,
    };
  };

  const resolveHost = (request: IncomingMessage) => {
    const url = new URL(request.url || '', 'http://localhost:8888');
    const params = url.searchParams;
    const headers = request.headers;

    if (headers['host_token']) {
      url.searchParams.set('host_token', headers['host_token'] as string);
    }

    if (headers['terminal_id']) {
      url.searchParams.set('terminal_id', headers['terminal_id'] as string);
    }

    const terminal_id = params.get('terminal_id');

    let host_id: string;
    try {
      if (!terminal_id) return null;
      // ISSUE: is this secure to treat host as a special terminal?
      if (terminal_id === '@host') {
        if (!params.get('host_id')) return null;
        if (params.get('internal_host_key') !== internal_host_key) return null;
        host_id = params.get('host_id')!;
      } else {
        host_id = config.mapHostUrlToHostId(url.toString());
      }
    } catch (err) {
      MetricsHostManagerConnectionErrorCounter.add(1);
      console.info(formatTime(Date.now()), 'Auth Failed', url.toString(), `${err}`);
      return null;
    }

    // create host if not exists
    const host = (hosts[host_id] ??= createHost(host_id));
    return { host, terminal_id };
  };

  const server = createServer();

  server.addListener('request', async (req, res) => {
    const theUrl = new URL(req.url || '', 'http://localhost:8888');
    const x = resolveHost(req);
    if (!x) {
      MetricsHostManagerConnectionErrorCounter.add(1);
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    if (theUrl.pathname.startsWith('/external/')) {
      const reqBody = await new Promise<string>((resolve) => {
        const body: Uint8Array[] = [];
        req.on('data', (chunk) => {
          body.push(chunk);
        });
        req.on('end', () => {
          const reqBody = Buffer.concat(body).toString();
          resolve(reqBody);
        });
      });

      const reqJson = {
        method: req.method,
        url: req.url,
        pathname: theUrl.pathname,
        headers: req.headers,
        body: reqBody,
        host_id: x?.host.host_id,
      };

      try {
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
      } catch (e) {
        res.writeHead(500);
        res.end(`${e}`);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocket.Server({
    noServer: true,
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

  const dispose = () => {
    console.info(formatTime(Date.now()), 'HostManager', 'Disposing');
    for (const [host_id, host] of Object.entries(hosts)) {
      host?.dispose();
    }
    wss.close();
    server.close();
    console.info(formatTime(Date.now()), 'HostManager', 'Disposed');
  };

  server.on('upgrade', async (request, socket, head) => {
    const x = resolveHost(request);
    if (!x) {
      MetricsHostManagerConnectionErrorCounter.add(1);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // create host if not exists
    const { host, terminal_id } = x;
    const host_id = host.host_id;

    wss.handleUpgrade(request, socket, head, (ws) => {
      console.info(formatTime(Date.now()), 'Host', host_id, 'terminal connected', terminal_id);
      MetricsHostManagerConnectionEstablishedCounter.add(1, {
        host_id,
        terminal_id,
      });
      const oldTerminal = host.mapTerminalIdToSocket[terminal_id];
      if (oldTerminal) {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal replaced', terminal_id);
        oldTerminal.close();
      }
      host.mapTerminalIdToSocket[terminal_id] = ws; // Register New Terminal
      // Forward Terminal Messages
      (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) => {
        const raw_message = origin.data.toString();
        MetricsHostManagerMessageSize.record(raw_message.length, {
          host_id,
          source_terminal_id: terminal_id,
        });
        const idx = raw_message.indexOf('\n');
        const raw_headers = raw_message.slice(0, idx + 1);
        let target_terminal_id;
        try {
          const headers = JSON.parse(raw_headers);
          target_terminal_id = headers.target_terminal_id;
          if (!target_terminal_id) return; // Skip if target_terminal_id not defined
          if (!host.terminalInfos.has(target_terminal_id)) return; // Skip if Terminal Not Found
          // forward the message as is
          host.mapTerminalIdToSocket[target_terminal_id]?.send(raw_message);
        } catch (e) {
          console.error(formatTime(Date.now()), 'InvalidHeader', raw_headers);
          return;
        }
      });
      // Clean up on Terminal Disconnect
      fromEvent(ws, 'close').subscribe(() => {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal disconnected', terminal_id);
        host.terminalInfos.delete(terminal_id);
        host.mapTerminalIdToSocket[terminal_id]?.terminate();
        // MetricsHostManagerMessageSize.clear({
        //   host_id,
        //   source_terminal_id: terminal_id,
        // });
        // MetricsHostManagerConnectionEstablishedCounter.clear({
        //   host_id,
        //   terminal_id,
        // });
        delete host.mapTerminalIdToSocket[terminal_id];
      });
    });
  });

  server.listen(8888);

  return {
    hosts,
    dispose,
  };
};
