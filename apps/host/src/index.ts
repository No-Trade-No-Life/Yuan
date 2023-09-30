import { formatTime } from '@yuants/data-model';
import { createServer } from 'http';
import { Observable, bindCallback, fromEvent, merge } from 'rxjs';
import WebSocket from 'ws';

const mapTerminalIdToSocket: Record<string, WebSocket.WebSocket> = {};

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
  if (!((!process.env.HOST_TOKEN || host_token === process.env.HOST_TOKEN) && terminal_id)) {
    console.info(formatTime(Date.now()), 'Auth Failed', { terminal_id, host_token });
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.info(formatTime(Date.now()), 'New Connection', { terminal_id });
    mapTerminalIdToSocket[terminal_id]?.close(); // 关闭旧连接
    mapTerminalIdToSocket[terminal_id] = ws; // 注册终端
    // 配置消息转发
    (fromEvent(ws, 'message') as Observable<WebSocket.MessageEvent>).subscribe((origin) =>
      mapTerminalIdToSocket[JSON.parse(origin.data.toString()).target_terminal_id]?.send(origin.data),
    );
  });
});

server.listen(8888);
