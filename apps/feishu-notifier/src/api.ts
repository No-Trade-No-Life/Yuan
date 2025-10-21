import { formatTime } from '@yuants/utils';
import { expand, firstValueFrom, map, mergeMap, of, retry, shareReplay, skip, tap, timer } from 'rxjs';

export interface SendFeishuMessagePayload {
  message_id?: string;
  user_id?: string;
  msg_type: string;
  content: unknown;
  uuid?: string;
  urgent?: string;
}

const URGENT_ENDPOINTS: Record<string, string> = {
  app: 'urgent_app',
  sms: 'urgent_sms',
  phone: 'urgent_phone',
};

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
            }).then((resp) => resp.json()) as any,
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

  sendMessage = async (payload: SendFeishuMessagePayload): Promise<{ message_id: string }> => {
    const { message_id, user_id, msg_type, content, uuid, urgent } = payload;
    console.info(
      formatTime(Date.now()),
      'Feishu/Send',
      message_id ? 'update' : 'create',
      message_id ?? user_id,
    );
    const token = await firstValueFrom(this.token$);

    let targetMessageId = message_id;

    if (message_id) {
      const updateResp: { code: number; msg: string } = (await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${message_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            msg_type,
            content,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      ).then((x) => x.json())) as any;
      if (updateResp.code !== 0) throw updateResp;
    } else {
      if (!user_id) {
        throw new Error('user_id is required when message_id is not provided');
      }

      const sendResp: { code: number; msg: string; data: { message_id: string } } = (await fetch(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id',
        {
          method: 'POST',
          body: JSON.stringify({
            receive_id: user_id,
            msg_type,
            content,
            ...(uuid ? { uuid } : {}),
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      ).then((x) => x.json())) as any;
      if (sendResp.code !== 0) throw sendResp;

      targetMessageId = sendResp.data?.message_id;
    }

    if (!targetMessageId) {
      throw new Error('message_id is missing from Feishu response');
    }

    if (urgent) {
      if (!user_id) {
        throw new Error('user_id is required when urgent is specified');
      }
      const urgentEndpoint = URGENT_ENDPOINTS[urgent];
      if (!urgentEndpoint) {
        throw new Error(`Unsupported urgent type: ${urgent}`);
      }
      const urgentResp: { code: number; msg: string } = (await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${targetMessageId}/${urgentEndpoint}?user_id_type=user_id`,
        {
          method: 'PATCH',
          body: JSON.stringify({ user_id_list: [user_id] }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      ).then((x) => x.json())) as any;
      if (urgentResp.code !== 0) throw urgentResp;
    }

    return { message_id: targetMessageId };
  };

  sendTextMessage = async (user_id: string, text: string) =>
    this.sendMessage({
      user_id,
      msg_type: 'text',
      content: { text },
    });
}
