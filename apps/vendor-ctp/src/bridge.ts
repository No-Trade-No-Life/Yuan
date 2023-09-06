import {
  catchError,
  concatMap,
  delayWhen,
  EMPTY,
  filter,
  first,
  from,
  map,
  mergeMap,
  of,
  shareReplay,
  Subject,
  tap,
  timeout,
} from 'rxjs';
import * as zmq from 'zeromq';

const context = new zmq.Context({ maxSockets: 1024 * 1024 });

export interface IBridgeMessage<Req, Rep> {
  request_id: number;
  req?: {
    method: string;
    params: Req; // in JSON
  };
  res?: {
    error_code: number;
    error_message: string;
    event: string;
    value?: Rep; // in JSON
    is_last: boolean;
  };
}

export const createZMQConnection = (ZMQ_PUSH_URL: string, ZMQ_PULL_URL: string) => {
  const input$ = new Subject<IBridgeMessage<any, any>>();
  const output$ = new Subject<IBridgeMessage<any, any>>();
  const connection$ = new Subject<unknown>();

  const pullSock = new zmq.Pull({ context });
  pullSock.connect(ZMQ_PULL_URL);

  const pushSock = new zmq.Push({ context });

  const bind$ = from(pushSock.bind(ZMQ_PUSH_URL)).pipe(
    //
    shareReplay(1),
  );

  pushSock.events.on('accept', (e) => {
    console.debug(new Date(), 'onAccept', e.address);
    connection$.next(e);
  });

  from(pullSock)
    .pipe(
      //
      tap((rep) => {
        console.debug(new Date(), `ZMQ PULL: ${rep}`);
      }),
      map((msg) => JSON.parse(msg.toString())),
    )
    .subscribe((res) => input$.next(res));

  output$
    .pipe(
      //
      filter((msg) => msg.req !== undefined),
      delayWhen(() => bind$),
      concatMap((req) =>
        of(req).pipe(
          map((msg) => JSON.stringify([msg])),
          tap((reqString) => {
            console.debug(new Date(), `ZMQ PUSH: ${reqString}`);
          }),
          mergeMap((reqString) => pushSock.send(reqString)),
          delayWhen(() =>
            input$.pipe(
              //
              filter((msg) => msg.request_id === req.request_id && msg.res !== undefined),
              first((msg) => msg.res!.is_last),
              timeout({ each: 5000 }),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),
    )
    .subscribe();

  return { input$, output$, connection$ };
};
