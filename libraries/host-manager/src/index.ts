import { formatTime, UUID } from '@yuants/data-model';
import { ITerminalInfo, ITerminalMessage, PromRegistry, Terminal } from '@yuants/protocol';
import { createServer } from 'http';
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
  mapTerminalIdToHasHeader: Record<string, boolean>;
  terminalInfos: Map<string, ITerminalInfo>;
  host_id: string;
  host_terminal: Terminal;
  dispose: () => void;
}

const MetricsHostManagerMessageSize = PromRegistry.create('histogram', 'host_manager_message_size');
const MetricsHostManagerConnectionEstablishedCounter = PromRegistry.create(
  'counter',
  'host_manager_connection_established',
);
const MetricsHostManagerConnectionErrorCounter = PromRegistry.create(
  'counter',
  'host_manager_connection_error',
);

/**
 * @public
 */
export const createNodeJSHostManager = (config: IHostManagerConfig): IHostManger => {
  const internal_host_key = UUID();
  const hosts: Record<string, IHost | undefined> = {};

  const createHost = (host_id: string): IHost => {
    console.info(formatTime(Date.now()), 'Host Creating', host_id);
    const mapTerminalIdToSocket: Record<string, WebSocket.WebSocket> = {};
    const mapTerminalIdToHasHeader: Record<string, boolean> = {};

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
    const terminal = new Terminal(HOST_URL, {
      terminal_id: '@host',
      name: 'Host Terminal',
    });

    const terminalInfos = new Map<string, ITerminalInfo>();

    const listTerminalsMessage$ = interval(1000).pipe(
      map(() => ({ res: { code: 0, message: 'OK', data: [...terminalInfos.values()] } })),
      shareReplay(1),
    );

    const terminalInfo$ = new Subject<ITerminalInfo>();

    terminal.provideChannel<ITerminalInfo>({ const: 'TerminalInfo' }, () => terminalInfo$);

    terminal.provideService('ListTerminals', {}, () => listTerminalsMessage$.pipe(first()));

    terminal.provideService('UpdateTerminalInfo', {}, async (msg) => {
      terminalInfos.set(msg.req.terminal_id, msg.req);
      terminalInfo$.next(msg.req);
      return { res: { code: 0, message: 'OK' } };
    });

    terminal.provideService('Terminate', {}, async (msg) => {
      return {
        res: {
          code: 403,
          message: `You are not allowed to terminate this terminal`,
        },
      };
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
                terminalInfos.delete(target_terminal_id);
                mapTerminalIdToSocket[target_terminal_id]?.terminate();
                delete mapTerminalIdToSocket[target_terminal_id];
                delete mapTerminalIdToHasHeader[target_terminal_id];
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
      mapTerminalIdToHasHeader,
      mapTerminalIdToSocket,
      terminalInfos,
      dispose,
    };
  };

  const server = createServer();

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
    const url = new URL(request.url || '', 'http://localhost:8888');
    console.info(
      formatTime(Date.now()),
      'HostManager',
      'Upgrade',
      url.toString(),
      request.socket.remoteAddress,
    );
    const params = url.searchParams;
    const terminal_id = params.get('terminal_id');
    const has_header = params.get('has_header') === 'true';

    let host_id: string;
    try {
      if (!terminal_id) throw new Error('TerminalIdRequired');
      // ISSUE: is this secure to treat host as a special terminal?
      if (terminal_id === '@host') {
        if (!params.get('host_id')) throw new Error('HostIdRequired');
        if (params.get('internal_host_key') !== internal_host_key) throw new Error('InvalidInternalHostKey');
        host_id = params.get('host_id')!;
      } else {
        host_id = config.mapHostUrlToHostId(url.toString());
      }
    } catch (err) {
      MetricsHostManagerConnectionErrorCounter.inc();
      console.info(formatTime(Date.now()), 'Auth Failed', url.toString(), `${err}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // create host if not exists
    const host = (hosts[host_id] ??= createHost(host_id));

    wss.handleUpgrade(request, socket, head, (ws) => {
      console.info(formatTime(Date.now()), 'Host', host_id, 'terminal connected', terminal_id);
      MetricsHostManagerConnectionEstablishedCounter.inc({
        host_id,
        terminal_id,
        has_header: has_header ? 'true' : 'false',
      });
      const oldTerminal = host.mapTerminalIdToSocket[terminal_id];
      if (oldTerminal) {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal replaced', terminal_id);
        oldTerminal.close();
      }
      host.mapTerminalIdToSocket[terminal_id] = ws; // Register New Terminal
      host.mapTerminalIdToHasHeader[terminal_id] = has_header;
      // Forward Terminal Messages
      (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) => {
        const raw_message = origin.data.toString();
        MetricsHostManagerMessageSize.observe(raw_message.length, {
          host_id,
          has_header: has_header ? 'true' : 'false',
          source_terminal_id: terminal_id,
        });
        if (has_header) {
          const idx = raw_message.indexOf('\n');
          const raw_headers = raw_message.slice(0, idx + 1);
          let target_terminal_id;
          try {
            const headers = JSON.parse(raw_headers);
            if (headers.target_terminal_ids) {
              // Multicast
              for (const target_terminal_id of headers.target_terminal_ids) {
                if (!target_terminal_id) continue; // Skip if target_terminal_id not defined
                if (!host.terminalInfos.has(target_terminal_id)) continue; // Skip if Terminal Not Found
                if (!host.mapTerminalIdToHasHeader[target_terminal_id]) {
                  // ISSUE: Designed for backward compatiable. Remove this branch if all terminals support has_header messages
                  // if target terminal does not support header, strip the header and forward the message
                  host.mapTerminalIdToSocket[target_terminal_id]?.send(raw_message.slice(idx + 1));
                  continue;
                }
                // forward the message as is
                host.mapTerminalIdToSocket[target_terminal_id]?.send(raw_message);
              }
              return;
            }
            target_terminal_id = headers.target_terminal_id;
            if (!target_terminal_id) return; // Skip if target_terminal_id not defined
            if (!host.terminalInfos.has(target_terminal_id)) return; // Skip if Terminal Not Found
            if (!host.mapTerminalIdToHasHeader[target_terminal_id]) {
              // ISSUE: Designed for backward compatiable. Remove this branch if all terminals support has_header messages
              // if target terminal does not support header, strip the header and forward the message
              host.mapTerminalIdToSocket[target_terminal_id]?.send(raw_message.slice(idx + 1));
              return;
            }
            // if target terminal supports header, forward the message as is
            host.mapTerminalIdToSocket[target_terminal_id]?.send(raw_message);
          } catch (e) {
            console.error(formatTime(Date.now()), 'InvalidHeader', raw_headers);
            return;
          }
        } else {
          // message without headers
          try {
            const msg: ITerminalMessage = JSON.parse(raw_message);
            const target_terminal_id = msg.target_terminal_id;
            if (!host.terminalInfos.has(target_terminal_id)) return; // Skip if Terminal Not Found
            if (!host.mapTerminalIdToHasHeader[target_terminal_id]) {
              // ISSUE: Designed for backward compatiable. Remove this branch if all terminals support has_header messages
              // if target terminal does not support headers, forward the message as is
              host.mapTerminalIdToSocket[target_terminal_id]?.send(origin.data);
              return;
            }
            const headers = {
              target_terminal_id: msg.target_terminal_id,
              target_terminal_ids: msg.target_terminal_id,
              source_terminal_id: msg.source_terminal_id,
            };
            // if target terminal supports headers, wrap the message with header and forward
            host.mapTerminalIdToSocket[target_terminal_id]?.send(
              JSON.stringify(headers) + '\n' + raw_message,
            );
          } catch (e) {
            console.error(formatTime(Date.now()), 'InvalidMessage', raw_message);
            return;
          }
        }
      });
      // Clean up on Terminal Disconnect
      fromEvent(ws, 'close').subscribe(() => {
        console.info(formatTime(Date.now()), 'Host', host_id, 'terminal disconnected', terminal_id);
        host.terminalInfos.delete(terminal_id);
        host.mapTerminalIdToSocket[terminal_id]?.terminate();
        delete host.mapTerminalIdToSocket[terminal_id];
        delete host.mapTerminalIdToHasHeader[terminal_id];
      });
    });
  });

  server.listen(8888);

  return {
    hosts,
    dispose,
  };
};
