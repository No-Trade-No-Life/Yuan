import { Observable, Subject } from 'rxjs';
import { formatTime, UUID } from '@yuants/utils';
import { WebSocket } from 'ws';

const MARKET_INFO_WS_URL = 'wss://free-api.shinnytech.com/t/nfmd/front/mobile';

const pool = new Set<WebSocket>();

export const useTQ = () =>
  new Observable<{
    ws: WebSocket;
    input$: Subject<any>;
    output$: Subject<any>;
  }>((sub) => {
    const ws = new WebSocket(MARKET_INFO_WS_URL);
    const id = UUID();

    const input$ = new Subject<any>();
    const output$ = new Subject<any>();
    pool.add(ws);

    ws.addEventListener('open', () => {
      console.info(formatTime(Date.now()), 'TQ_WS_OPEN', id, pool.size);
      sub.next({ ws, input$, output$ });
    });

    ws.addEventListener('error', (err) => {
      console.error(formatTime(Date.now()), 'TQ_WS_ERROR', id, pool.size, err);
      sub.error(err);
    });

    ws.addEventListener('close', () => {
      console.info(formatTime(Date.now()), 'TQ_WS_CLOSE', id, pool.size);
      sub.complete();
    });

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data.toString());
      input$.next(data);
    });

    sub.add(() => {
      pool.delete(ws);
      ws.close();
    });

    const sub1 = output$.subscribe((msg) => {
      ws.send(JSON.stringify(msg));
    });

    sub.add(() => {
      sub1.unsubscribe();
      output$.complete();
    });
  });
