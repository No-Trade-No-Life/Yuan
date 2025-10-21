import { Terminal } from '@yuants/protocol';
import { catchError, defer, from, map, mergeMap, timeout } from 'rxjs';
import { FeishuClient } from './api';

const APP_ID = process.env.APP_ID!;
const APP_SECRET = process.env.APP_SECRET!;
const EMERGENCY_RECEIVER_ID = process.env.EMERGENCY_RECEIVER_ID ?? '';
const terminal = Terminal.fromNodeEnv();

const client = new FeishuClient({
  auth: {
    APP_ID,
    APP_SECRET,
  },
});

// Alert when HOST lost connection
defer(() => terminal.input$)
  .pipe(
    //
    timeout(60000),
    catchError(() =>
      from(EMERGENCY_RECEIVER_ID.split(';')).pipe(
        mergeMap((v) =>
          client.sendTextMessage(
            v,
            `CRITICAL ALERTING: HOST connection lost\nHOST_URL: ${terminal.host_url}`,
          ),
        ),
      ),
    ),
  )
  .subscribe();

terminal.server.provideService<
  {
    receive_id: string;
    receive_id_type: string;
    msg_type: string;
    content: string;
    uuid?: string;
    urgent?: string;
    urgent_user_list?: string[];
  },
  {
    message_id: string;
  }
>(
  'Feishu/SendMessage',
  {
    type: 'object',
    required: ['receive_id', 'receive_id_type', 'msg_type', 'content'],
    properties: {
      receive_id: { type: 'string' },
      receive_id_type: { type: 'string', enum: ['user_id', 'open_id', 'union_id', 'email', 'chat_id'] },
      msg_type: { type: 'string' },
      content: { type: 'string' },
      uuid: { type: 'string' },
      urgent: { type: 'string', enum: ['app', 'sms', 'phone'] },
      urgent_user_list: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  (msg) => from(client.sendMessage(msg.req)).pipe(map((data) => ({ res: { code: 0, message: 'OK', data } }))),
);

terminal.server.provideService<
  {
    message_id: string;
    msg_type: string;
    content: string;
    urgent?: string;
    urgent_user_list?: string[];
  },
  {
    message_id: string;
  }
>(
  'Feishu/UpdateMessage',
  {
    type: 'object',
    required: ['message_id', 'msg_type', 'content'],
    properties: {
      message_id: { type: 'string' },
      msg_type: { type: 'string' },
      content: { type: 'string' },
      urgent: { type: 'string', enum: ['app', 'sms', 'phone'] },
      urgent_user_list: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  (msg) =>
    from(client.updateMessage(msg.req)).pipe(map((data) => ({ res: { code: 0, message: 'OK', data } }))),
);
