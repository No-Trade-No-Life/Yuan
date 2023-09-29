import { formatTime } from '@yuants/data-model';
import { IResponse, Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/notify';
import Axios from 'axios';
import {
  Observable,
  catchError,
  defer,
  expand,
  filter,
  first,
  from,
  map,
  mergeMap,
  of,
  retry,
  shareReplay,
  skip,
  tap,
  throwIfEmpty,
  timeout,
  timer,
} from 'rxjs';

const HV_URL = process.env.HV_URL!;

const TERMINAL_ID = process.env.TERMINAL_ID || `notifier/feishu/${process.env.APP_ID!}`;
const APP_ID = process.env.APP_ID!;
const APP_SECRET = process.env.APP_SECRET!;
const EMERGENCY_RECEIVER_ID = process.env.EMERGENCY_RECEIVER_ID!;
const ENV = process.env.ENV!;
const term = new Terminal(HV_URL, { terminal_id: TERMINAL_ID, name: 'Notifier Feishu', status: 'OK' });

const token$ = of({ expire: 0 }).pipe(
  // Token expire in 2 hour https://open.feishu.cn/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM
  expand((v) =>
    timer((v.expire - 1) * 1000).pipe(
      //
      mergeMap(() =>
        Axios.post(
          'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
          {
            app_id: APP_ID,
            app_secret: APP_SECRET,
          },
          {
            headers: { 'Content-Type': 'application/json', charset: 'utf-8' },
            validateStatus: (status) => status < 500,
          },
        ),
      ),
      map((resp) => resp.data as { code: number; msg: string; expire: number; app_access_token: string }),
      tap((resp) => {
        if (resp.code !== 0) {
          console.error(formatTime(Date.now()), 'SendFeishuMessageError', JSON.stringify(resp));
        } else {
          console.info(formatTime(Date.now()), 'TokenExpire', resp.expire);
        }
      }),
      mergeMap((v) => {
        if (v.code === 0) {
          return of(v);
        }
        throw v;
      }),
      retry({ delay: 5000 }),
    ),
  ),
  map((v) => v.app_access_token),
  skip(1),
  shareReplay(1),
);

// Alert when HOST lost connection
term._conn.input$
  .pipe(
    //
    timeout(60000),
    catchError(() =>
      from(EMERGENCY_RECEIVER_ID.split(';')).pipe(
        mergeMap((v) =>
          sendFeishuMessage(v, `CRITICAL ALERTING: HOST connection lost\nHOST_URL: ${HV_URL}\nENV: ${ENV}`),
        ),
      ),
    ),
  )
  .subscribe();

term.setupService('Notify', (msg) =>
  sendFeishuMessage(msg.req.receiver_id, msg.req.message).pipe(
    //
    map((v) => ({ res: v })),
  ),
);

function sendFeishuMessage(receiver_id: string, msg: string): Observable<IResponse> {
  return token$.pipe(
    first(),
    mergeMap((token) => {
      const [subject, ...content] = msg.split('\n');
      const message = {
        header: {
          template: receiver_id.startsWith('app-') ? 'red' : 'blue',
          title: { content: subject, tag: 'plain_text' },
        },
        elements: [
          {
            tag: 'div',
            text: {
              content: content.join('\n'),
              tag: 'lark_md',
            },
          },
        ],
      };
      return defer(() =>
        Axios.post(
          'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id',
          {
            receive_id: receiver_id.replace(/^app-/, ''),
            content: JSON.stringify(message),
            msg_type: 'interactive',
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              charset: 'utf-8',
            },
            validateStatus: (status) => status < 500,
          },
        ),
      ).pipe(
        map((resp) => resp.data as { code: number; msg: string; data: { message_id: string } }),
        tap((resp) => {
          if (resp.code !== 0) {
            console.error(formatTime(Date.now()), 'SendFeishuMessageError', JSON.stringify(resp));
          }
        }),
        mergeMap((v) => {
          if (v.code === 0) {
            return of(v);
          }
          throw v;
        }),
        retry({ delay: 1000, count: 3 }),
        mergeMap((resp) => {
          if (resp.code === 0 && receiver_id.startsWith('app-')) {
            return defer(() =>
              Axios.patch(
                `https://open.feishu.cn/open-apis/im/v1/messages/${resp.data.message_id}/urgent_app?user_id_type=user_id`,
                { user_id_list: [receiver_id.replace(/^app-/, '')] },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    charset: 'utf-8',
                  },
                  validateStatus: (status) => status < 500,
                },
              ),
            ).pipe(
              //
              map((resp) => resp.data as { code: number; msg: string; data: { message_id: string } }),
              tap((resp) => {
                if (resp.code !== 0) {
                  console.error(formatTime(Date.now()), 'MakeUrgentFailed', JSON.stringify(resp));
                }
              }),
              filter((v) => v.code === 0),
              throwIfEmpty(),
              retry({ delay: 1000, count: 3 }),
              catchError(() => of(0)),
              map(() => ({ code: 0, message: 'OK' })),
            );
          } else {
            return of({ code: resp.code, message: resp.msg });
          }
        }),
        catchError((e) =>
          of({ code: e.code ?? 400, message: JSON.stringify(e) ?? 'send feishu message failed' }),
        ),
      );
    }),
  );
}
