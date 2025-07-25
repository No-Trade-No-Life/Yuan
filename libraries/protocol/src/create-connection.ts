import { formatTime } from '@yuants/utils';
import WebSocket from 'isomorphic-ws';
import {
  Observable,
  ReplaySubject,
  Subject,
  bufferTime,
  defer,
  from,
  fromEvent,
  map,
  mergeMap,
  repeat,
  share,
  takeLast,
  takeUntil,
  throwError,
  timeout,
} from 'rxjs';

/**
 * Connection Channel
 * @public
 */
export interface IConnection<T> {
  /** Readonly Input Stream */
  input$: Observable<T>;
  /** Writeable Output Stream  */
  output$: Subject<T>;
  /** Connection established Action */
  connection$: Observable<unknown>;

  isConnected$: Observable<boolean>;
}

/**
 * Create a WebSocket client that supports reconnection
 * Provides an RxJS interface
 * Does not assume the shape of the interface to connect to
 * @public
 */
export function createConnectionWs<T = any>(URL: string): IConnection<T> {
  const serviceWsRef = { current: null as WebSocket | null };

  const input$ = new Subject<any>();
  const output$ = new Subject<any>();
  const connection$ = new Subject<any>();
  const isConnected$ = new ReplaySubject<boolean>(1);

  // ISSUE: Messages are lost when not connected and need to be buffered and resent
  // - When not connected for a long time, messages accumulate, causing high memory usage.
  //   After the connection is established, sending too much data at once may impact the server.
  // - When the connection is restored, buffered messages should be sent immediately.
  // - Messages should not be sent multiple times, as this will cause the server to process the business layer repeatedly.
  // - It is not necessary to ensure that all messages are resent, as the overall reliability can also be ensured by retrying in the business layer.
  // - Only messages within a certain time frame can be cached, as requests that are too early may have already timed out and will not be retried.
  const buffer$ = new Subject<any>();
  defer(() => buffer$)
    .pipe(
      takeUntil(connection$),
      // Cache messages for 1 second each time, up to a maximum of 10
      bufferTime(1000),
      takeLast(10),
      mergeMap((x) => x),
      repeat(),
    )
    .subscribe({
      next: (x) => {
        output$.next(x);
      },
    });

  const connect = () => {
    const ws = (serviceWsRef.current = new WebSocket(URL));
    isConnected$.next(false);
    ws.addEventListener('open', () => {
      console.debug(formatTime(Date.now()), 'connection established', URL);
      connection$.next(ws);
      isConnected$.next(true);
    });
    ws.addEventListener('error', (e: any) => {
      console.error(formatTime(Date.now()), 'WebSocketConnectionError', e.error);
      isConnected$.next(false);
      ws.close();
    });
    ws.addEventListener('close', () => {
      console.debug(formatTime(Date.now()), 'connection closed', URL);
      isConnected$.next(false);
      // Allow external control of reconnection through output.complete or output.error
      if (!output$.isStopped) {
        setTimeout(connect, 1000); // reconnect after 1 sec
      }
    });
    const msg$ = fromEvent(ws, 'message') as Observable<any>;
    msg$.pipe(timeout({ each: 60000, with: () => throwError(() => new Error('timeout')) })).subscribe({
      error: () => {
        // Issue: The browser does not have the `ws.terminate()` method
        // Also, say goodbye to the host before leaving out of "politeness"
        ws.close();
        console.info(formatTime(Date.now()), 'connection terminated: 60s timeout');
      },
    });
    msg$.pipe(map((x) => x.data)).subscribe((x) => {
      input$.next(x);
    });
  };

  output$.subscribe({
    next: (msg) => {
      const ws = serviceWsRef.current;
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(msg);
      } else {
        buffer$.next(msg);
      }
    },
    complete: () => {
      console.debug(formatTime(Date.now()), 'connection closing because output complete', URL);
      serviceWsRef.current?.close();
    },
    error: (err) => {
      console.debug(formatTime(Date.now()), 'connection closing because output error', URL, `${err}`);
      serviceWsRef.current?.close();
    },
  });

  connect(); // init connect

  return {
    input$: input$,
    output$: output$,
    connection$: connection$,
    isConnected$: isConnected$,
  };
}

/**
 * Create a connection channel for transmitting JSON
 * @public
 */
export function createConnectionJson<T = any>(URL: string): IConnection<T> {
  const conn = createConnectionWs(URL);
  const input$ = from(conn.input$).pipe(
    map((msg) => msg.toString()),
    map((msg) => JSON.parse(msg)),
    share(),
  );
  const output$ = new Subject<any>();
  output$.pipe(map((msg) => JSON.stringify(msg))).subscribe(conn.output$);
  return {
    input$: input$,
    output$: output$,
    connection$: conn.connection$,
    isConnected$: conn.isConnected$,
  };
}
