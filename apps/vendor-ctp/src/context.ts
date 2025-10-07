import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { Observable, filter, map, tap } from 'rxjs';
import { IBridgeMessage } from './interfaces';

export type RequestZMQ = <Req, Res>(req: {
  method: string;
  params: Req;
}) => Observable<IBridgeMessage<Req, Res>>;

export const terminal = Terminal.fromNodeEnv();
export const BROKER_ID = process.env.BROKER_ID!;
export const INVESTOR_ID = process.env.USER_ID!;
export const ACCOUNT_ID = encodePath(BROKER_ID, INVESTOR_ID);
export const DATASOURCE_ID = ACCOUNT_ID;

export const requestZMQ: RequestZMQ = (req) =>
  terminal.client
    .requestService<any, any, IBridgeMessage<any, any>>('CTP/Query', {
      account_id: ACCOUNT_ID,
      method: req.method,
      params: req.params,
    })
    .pipe(
      tap({
        subscribe: () => console.info(formatTime(Date.now()), 'Request_ZMQ', JSON.stringify(req)),
        next: (msg) => console.info(formatTime(Date.now()), 'ZMQ_Res', JSON.stringify(msg)),
        error: (err) => {
          console.info(formatTime(Date.now()), 'Request_ZMQ_Error', err);
        },
      }),
      map((msg) => {
        if (msg.res && msg.res.code !== 0) {
          throw msg.res.message;
        }
        return msg.frame;
      }),
      filter((x): x is Exclude<typeof x, undefined> => Boolean(x)),
    );
