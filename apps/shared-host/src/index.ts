import { createClient } from '@supabase/supabase-js';
import { formatTime } from '@yuants/data-model';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { createServer } from 'http';
import {
  Observable,
  Subject,
  bindCallback,
  defer,
  first,
  fromEvent,
  interval,
  map,
  merge,
  of,
  repeat,
  retry,
  shareReplay,
} from 'rxjs';
import WebSocket from 'ws';

const mapHostIdToHostToken: Record<string, string> = {};
const mapHostIdAndTerminalIdToSocket: Record<string, Record<string, WebSocket.WebSocket>> = {};
const mapHostIdToHostTerminal: Record<string, Terminal> = {};
const mapHostIdToTerminalInfos: Record<string, Map<string, ITerminalInfo>> = {};

const createHostTerminal = (host_id: string, host_token: string) => {
  const HOST_URL = `ws://localhost:8888?host_id=${host_id}&host_token=${host_token}`;
  const terminal = new Terminal(HOST_URL, {
    terminal_id: '@host',
    name: 'Host Terminal',
  });

  const terminalInfos = (mapHostIdToTerminalInfos[host_id] ??= new Map<string, ITerminalInfo>());

  const listTerminalsMessage$ = interval(1000).pipe(
    map(() => ({ res: { code: 0, message: 'OK', data: [...terminalInfos.values()] } })),
    shareReplay(1),
  );

  terminal.provideService('Terminate', {}, (msg) => {
    return of({
      res: {
        code: 403,
        message: `You are not allowed to terminate this terminal`,
      },
    });
  });

  const terminalInfo$ = new Subject<ITerminalInfo>();

  terminal.provideChannel({ const: 'TerminalInfo' }, () => terminalInfo$);

  terminal.provideService('ListTerminals', {}, () => listTerminalsMessage$.pipe(first()));

  terminal.provideService('UpdateTerminalInfo', {}, async (msg) => {
    terminalInfos.set(msg.req.terminal_id, msg.req);
    terminalInfo$.next(msg.req);
    return { res: { code: 0, message: 'OK' } };
  });
  return terminal;
};

const createHost = (host_id: string, host_token: string) => {
  if (mapHostIdToHostToken[host_id] === host_token) return;
  console.info(formatTime(Date.now()), 'Host', 'create', `host_id=${host_id}, host_token=${host_token}`);
  mapHostIdToHostToken[host_id] = host_token;
  mapHostIdToHostTerminal[host_id] = createHostTerminal(host_id, host_token);
  mapHostIdAndTerminalIdToSocket[host_id] = {};
};

const deleteHost = (host_id: string) => {
  console.info(formatTime(Date.now()), 'Host', 'delete', `host_id=${host_id}`);
  for (const ws of Object.values(mapHostIdAndTerminalIdToSocket[host_id] ?? {})) {
    ws.close();
  }
  mapHostIdToHostTerminal[host_id]?.dispose();
  delete mapHostIdToHostTerminal[host_id];
  delete mapHostIdToHostToken[host_id];
  delete mapHostIdAndTerminalIdToSocket[host_id];
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

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// TODO: replace with @yuants/supabase-utils
defer(() => supabase.from('host').select('*'))
  .pipe(
    //
    map((res) => res.data || []),
    retry({ delay: 5000 }),
    repeat({ delay: 300_000 }),
  )
  .subscribe((hosts) => {
    console.info(formatTime(Date.now()), 'Host', 'refresh', hosts.length);
    for (const [host_id, host_token] of Object.entries(mapHostIdToHostToken)) {
      const theHost = hosts.find((host) => host.id === host_id);
      if (!theHost || theHost.host_token !== host_token) {
        deleteHost(host_id);
      }
    }
    for (const host of hosts) {
      createHost(host.id, host.host_token);
    }
  });

const channel = supabase
  .channel('changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'host',
    },
    (payload) => {
      console.log(payload);
      if (payload.eventType === 'INSERT') {
        createHost(payload.new.id, payload.new.host_token);
      } else if (payload.eventType === 'UPDATE') {
        deleteHost(payload.old.id);
        createHost(payload.new.id, payload.new.host_token);
      } else if (payload.eventType === 'DELETE') {
        deleteHost(payload.old.id);
      }
    },
  )
  .subscribe();

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
  const host_id = params.get('host_id');
  const host_token = params.get('host_token');
  const terminal_id = params.get('terminal_id');
  if (!host_id || !host_token || !terminal_id) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }
  const theHostToken = mapHostIdToHostToken[host_id];
  if (theHostToken === undefined || host_token !== theHostToken) {
    console.info(
      formatTime(Date.now()),
      `terminal Error: Auth Failed, host_id=${host_id}, terminal_id=${terminal_id}`,
    );
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  const mapTerminalIdToSocket = (mapHostIdAndTerminalIdToSocket[host_id] ??= {});
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.info(formatTime(Date.now()), `terminal connected host_id=${host_id}, terminal_id=${terminal_id}`);
    mapTerminalIdToSocket[terminal_id]?.close(); // Close Old Terminal
    mapTerminalIdToSocket[terminal_id] = ws; // Register New Terminal
    // Forward Terminal Messages
    (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) =>
      mapTerminalIdToSocket[JSON.parse(origin.data.toString()).target_terminal_id]?.send(origin.data),
    );
    // Clean up on Terminal Disconnect
    fromEvent(ws, 'close').subscribe(() => {
      console.info(formatTime(Date.now()), 'terminal disconnected', terminal_id);
      mapHostIdToTerminalInfos[host_id].delete(terminal_id);
      delete mapTerminalIdToSocket[terminal_id];
    });
  });
});

server.listen(8888);
