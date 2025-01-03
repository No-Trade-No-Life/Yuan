import { formatTime } from '@yuants/data-model';
import { expand, firstValueFrom, map, mergeMap, of, retry, shareReplay, skip, tap, timer } from 'rxjs';

export class FeishuClient {
  constructor(
    public ctx: {
      auth: {
        APP_ID: string;
        APP_SECRET: string;
      };
    },
  ) {}

  private token$ = of({ expire: 0 }).pipe(
    // Token expire in 2 hour https://open.feishu.cn/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM
    expand((v) =>
      timer((v.expire - 1) * 1000).pipe(
        //
        mergeMap(
          (): Promise<{ code: number; msg: string; expire: number; app_access_token: string }> =>
            fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
              method: 'post',
              body: JSON.stringify({
                app_id: this.ctx.auth.APP_ID,
                app_secret: this.ctx.auth.APP_SECRET,
              }),
              headers: { 'Content-Type': 'application/json', charset: 'utf-8' },
            }).then((resp) => resp.json()),
        ),
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

  sendFeishuMessage = async (receiver_id: string, msg: string): Promise<void> => {
    const [type, userId] = receiver_id.match(/^(?:(app|phone)-)(\w+)$/)?.slice(1) ?? [];
    const isUrgent = type === 'app' || type === 'phone';
    console.info(formatTime(Date.now()), 'Sending', type, userId, msg);
    const token = await firstValueFrom(this.token$);
    const [subject, ...content] = msg.split('\n');
    const message = {
      header: {
        template: isUrgent ? 'red' : 'blue',
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
    // https://open.feishu.cn/document/server-docs/im-v1/message/create
    const resp: { code: number; msg: string; data: { message_id: string } } = await fetch(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id',
      {
        method: 'POST',
        body: JSON.stringify({
          receive_id: userId,
          content: JSON.stringify(message),
          msg_type: 'interactive',
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          charset: 'utf-8',
        },
      },
    ).then((x) => x.json());
    if (resp.code !== 0) throw resp;

    // 应用内加急
    if (type === 'app') {
      const resp1: { code: number; msg: string; data: { message_id: string } } = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${resp.data.message_id}/urgent_app?user_id_type=user_id`,
        {
          method: 'PATCH',
          body: JSON.stringify({ user_id_list: [userId] }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      ).then((x) => x.json());
    }
    // 电话加急
    if (type === 'phone') {
      const resp1: { code: number; msg: string; data: { message_id: string } } = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${resp.data.message_id}/urgent_phone?user_id_type=user_id`,
        {
          method: 'PATCH',
          body: JSON.stringify({ user_id_list: [userId] }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      ).then((x) => x.json());
    }
  };
}
