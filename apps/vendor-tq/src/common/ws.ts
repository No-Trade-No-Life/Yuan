import { createConnectionJson } from '@yuants/protocol';
import { from, share, Subject, tap } from 'rxjs';

const MARKET_INFO_WS_URL = 'wss://free-api.shinnytech.com/t/nfmd/front/mobile';

export const createConnectionTq = () => {
  const conn = createConnectionJson(MARKET_INFO_WS_URL);

  const input$ = from(conn.input$).pipe(
    tap((msg) => console.debug(new Date(), 'TQ', 'input$', JSON.stringify(msg))),
    share(),
  );

  const output$ = new Subject<any>();
  output$
    .pipe(
      //
      tap((msg) => console.debug(new Date(), 'TQ', 'output$', JSON.stringify(msg))),
    )
    .subscribe(conn.output$);
  const connection$ = conn.connection$;
  return {
    input$,
    output$,
    connection$,
  };
};
