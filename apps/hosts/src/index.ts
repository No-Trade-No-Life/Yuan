import { formatTime } from '@yuants/data-model';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { createKeyPair, fromPrivateKey, signMessage, verifyMessage } from '@yuants/utils';
import { createServer } from 'http';
import {
  Observable,
  Subject,
  bindCallback,
  first,
  fromEvent,
  interval,
  map,
  merge,
  of,
  shareReplay,
} from 'rxjs';
import WebSocket from 'ws';

const mapPublicKeyToTerminalIdToSocket: Record<string, Record<string, WebSocket.WebSocket>> = {};

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

  const public_key = params.get('public_key')!;
  const terminal_id = params.get('terminal_id')!;
  const signature = params.get('signature')!;

  const validateAuth = (): boolean => {
    if (!public_key) throw new Error('public_key is required');
    if (!terminal_id) throw new Error('terminal_id is required');
    if (!signature) throw new Error('signature is required');
    if (!verifyMessage('', signature, public_key)) throw new Error('signature is invalid');
    return true;
  };

  try {
    validateAuth();
  } catch (e) {
    console.info(formatTime(Date.now()), 'Auth Failed', url, 'reason', e);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  if (mapPublicKeyToTerminalIdToSocket[public_key] === undefined) {
    // Lazy Init Host
    const host_url = new URL('ws://localhost:8888');
    host_url.searchParams.set('public_key', public_key);
    host_url.searchParams.set('signature', signature);

    const terminal = new Terminal(host_url.toString(), {
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

    terminal.provideService('Terminate', {}, (msg) => {
      return of({
        res: {
          code: 403,
          message: `You are not allowed to terminate this terminal`,
        },
      });
    });
  }

  const mapTerminalIdToSocket = (mapPublicKeyToTerminalIdToSocket[public_key] ??= {});

  wss.handleUpgrade(request, socket, head, (ws) => {
    console.info(formatTime(Date.now()), public_key, 'terminal connected', terminal_id);
    const oldTerminal = mapTerminalIdToSocket[terminal_id];
    if (oldTerminal) {
      console.info(formatTime(Date.now()), public_key, 'terminal replaced', terminal_id);
      oldTerminal.close();
    }
    mapTerminalIdToSocket[terminal_id] = ws; // Register New Terminal
    // Forward Terminal Messages
    (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) => {
      const msg = JSON.parse(origin.data.toString());
      mapTerminalIdToSocket[msg.target_terminal_id]?.send(origin.data);
    });
    // Clean up on Terminal Disconnect
    fromEvent(ws, 'close').subscribe(() => {
      console.info(formatTime(Date.now()), public_key, 'terminal disconnected', terminal_id);
      // terminalInfos.delete(terminal_id);
      delete mapTerminalIdToSocket[terminal_id];
    });
  });
});

server.listen(8888);

// Setup Admin Terminal
const ADMIN_KEY_PAIR = process.env.ADMIN_SECRET_KEY
  ? fromPrivateKey(process.env.ADMIN_SECRET_KEY!)
  : createKeyPair();

console.info(
  formatTime(Date.now()),
  'Host Server Started',
  'ADMIN_HOST_URL',
  `ws://localhost:8888?public_key=${ADMIN_KEY_PAIR.public_key}&signature=${signMessage(
    '',
    ADMIN_KEY_PAIR.private_key,
  )}`,
);
