import { formatTime } from '@yuants/data-model';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { createServer } from 'http';
import {
  EMPTY,
  Observable,
  Subject,
  bindCallback,
  catchError,
  defer,
  first,
  from,
  fromEvent,
  interval,
  last,
  map,
  merge,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';
import WebSocket from 'ws';

const mapTerminalIdToSocket: Record<string, WebSocket.WebSocket> = {};
const mapTerminalIdToHasHeader: Record<string, boolean> = {};

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

merge(
  bindCallback(process.once).call(process, 'SIGINT'),
  bindCallback(process.once).call(process, 'SIGTERM'),
).subscribe((sig) => {
  console.info(formatTime(Date.now()), sig, 'terminate signal received, gracefully shutting down');
  // ISSUE: 关闭所有连接，提早终端感知到并重连
  for (const ws of wss.clients) {
    ws.close();
  }
  wss.close();
  server.close();
  console.info(formatTime(Date.now()), 'GracefullyShutdown', 'Done clean up');
  process.exit(0);
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', 'http://localhost:8888');
  const params = url.searchParams;
  const host_token = params.get('host_token');
  const terminal_id = params.get('terminal_id');
  const has_header = params.get('has_header') === 'true';
  if (!((!process.env.HOST_TOKEN || host_token === process.env.HOST_TOKEN) && terminal_id)) {
    console.info(formatTime(Date.now()), 'Auth Failed', url.toString());
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.info(formatTime(Date.now()), 'terminal connected', terminal_id);
    const oldTerminal = mapTerminalIdToSocket[terminal_id];
    if (oldTerminal) {
      console.info(formatTime(Date.now()), 'terminal replaced', terminal_id);
      oldTerminal.close();
    }
    mapTerminalIdToSocket[terminal_id] = ws; // Register New Terminal
    mapTerminalIdToHasHeader[terminal_id] = has_header;
    // Forward Terminal Messages
    (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) => {
      const raw_message = origin.data.toString();
      if (has_header) {
        const idx = raw_message.indexOf('\n');
        const raw_headers = raw_message.slice(0, idx + 1);
        let target_terminal_id;
        try {
          const headers = JSON.parse(raw_headers);
          target_terminal_id = headers.target_terminal_id;
          if (!target_terminal_id) return; // Skip if target_terminal_id not defined
          if (!terminalInfos.has(target_terminal_id)) return; // Skip if Terminal Not Found
          if (mapTerminalIdToHasHeader[target_terminal_id]) {
            // if target terminal supports header, forward the message as is
            mapTerminalIdToSocket[target_terminal_id]?.send(raw_message);
          } else {
            // if target terminal does not support header, strip the header and forward the message
            mapTerminalIdToSocket[target_terminal_id]?.send(raw_message.slice(idx + 1));
          }
        } catch (e) {
          console.error(formatTime(Date.now()), 'InvalidHeader', raw_headers);
          return;
        }
      } else {
        // message without headers
        try {
          const msg = JSON.parse(raw_message);
          const target_terminal_id = msg.target_terminal_id;
          if (!terminalInfos.has(target_terminal_id)) return; // Skip if Terminal Not Found
          if (mapTerminalIdToHasHeader[target_terminal_id]) {
            const headers = { target_terminal_id, source_terminal_id: msg.source_terminal_id };
            // if target terminal supports headers, wrap the message with header and forward
            mapTerminalIdToSocket[target_terminal_id]?.send(JSON.stringify(headers) + '\n' + raw_message);
          } else {
            // if target terminal does not support headers, forward the message as is
            mapTerminalIdToSocket[target_terminal_id]?.send(origin.data);
          }
        } catch (e) {
          console.error(formatTime(Date.now()), 'InvalidMessage', raw_message);
          return;
        }
      }
    });
    // Clean up on Terminal Disconnect
    fromEvent(ws, 'close').subscribe(() => {
      console.info(formatTime(Date.now()), 'terminal disconnected', terminal_id);
      terminalInfos.delete(terminal_id);
      mapTerminalIdToSocket[terminal_id]?.terminate();
      delete mapTerminalIdToSocket[terminal_id];
      delete mapTerminalIdToHasHeader[terminal_id];
    });
  });
});

server.listen(8888);

const HOST_URL = `ws://localhost:8888?has_header=true&host_token=${process.env.HOST_TOKEN}`;
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

terminal.provideService('UpdateTerminalInfo', {}, (msg) => {
  terminalInfos.set(msg.req.terminal_id, msg.req);
  terminalInfo$.next(msg.req);
  return of({ res: { code: 0, message: 'OK' } });
});

// ISSUE: Phantom Terminal Elimination
defer(() => terminalInfos.keys())
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
