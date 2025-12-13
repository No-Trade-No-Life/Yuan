import { formatTime } from '@yuants/utils';
import { expand, firstValueFrom, map, mergeMap, of, retry, shareReplay, skip, tap, timer } from 'rxjs';

export interface SendFeishuMessagePayload {
  receive_id: string;
  receive_id_type: string;
  msg_type: string;
  content: unknown;
  uuid?: string;
  urgent?: string;
  urgent_user_list?: string[];
}

export interface UpdateFeishuMessagePayload {
  message_id: string;
  msg_type: string;
  content: unknown;
  urgent?: string;
  urgent_user_list?: string[];
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

  private async triggerUrgent(options: { token: string; messageId: string; urgent: string; userId: string }) {
    const { token, messageId, urgent, userId } = options;
    const urgentEndpoint = URGENT_ENDPOINTS[urgent];
    if (!urgentEndpoint) {
      throw new Error(`Unsupported urgent type: ${urgent}`);
    }
    console.info(formatTime(Date.now()), 'Feishu/Urgent', urgent, messageId, userId);
    const urgentResp: { code: number; msg: string } = (await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/${urgentEndpoint}?user_id_type=user_id`,
      {
        method: 'PATCH',
        body: JSON.stringify({ user_id_list: [userId] }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          charset: 'utf-8',
        },
      },
    ).then((x) => x.json())) as any;
    if (urgentResp.code !== 0) throw urgentResp;
  }

  sendMessage = async (payload: SendFeishuMessagePayload): Promise<{ message_id: string }> => {
    const { receive_id, receive_id_type, msg_type, content, uuid, urgent, urgent_user_list } = payload;
    console.info(formatTime(Date.now()), 'Feishu/SendMessage', receive_id_type, receive_id);
    const token = await firstValueFrom(this.token$);

    const sendResp: { code: number; msg: string; data: { message_id: string } } = (await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(
        receive_id_type,
      )}`,
      {
        method: 'POST',
        body: JSON.stringify({
          receive_id,
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

    const messageId = sendResp.data?.message_id;
    if (!messageId) {
      throw new Error('message_id is missing from Feishu response');
    }

    if (urgent) {
      const userList = urgent_user_list;
      if (!userList || userList.length === 0) {
        throw new Error('urgent_user_list is required when urgent is specified');
      }
      for (const userId of userList) {
        await this.triggerUrgent({
          token,
          messageId,
          urgent,
          userId,
        });
      }
    }

    return { message_id: messageId };
  };

  updateMessage = async (payload: UpdateFeishuMessagePayload): Promise<{ message_id: string }> => {
    const { message_id, msg_type, content, urgent, urgent_user_list } = payload;
    console.info(formatTime(Date.now()), 'Feishu/UpdateMessage', message_id);
    const token = await firstValueFrom(this.token$);

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

    if (urgent) {
      const userList = urgent_user_list;
      if (!userList || userList.length === 0) {
        throw new Error('urgent_user_list is required when urgent is specified');
      }
      for (const userId of userList) {
        try {
          await this.triggerUrgent({
            token,
            messageId: message_id,
            urgent,
            userId,
          });
        } catch (err) {
          console.error(formatTime(Date.now()), 'Feishu/UrgentError', urgent, message_id, userId, err);
        }
      }
    }

    return { message_id };
  };

  sendTextMessage = async (user_id: string, text: string) =>
    this.sendMessage({
      receive_id: user_id,
      receive_id_type: 'user_id',
      msg_type: 'text',
      content: JSON.stringify({ text }),
      urgent: 'phone',
      urgent_user_list: [user_id],
    });
}
