import { Terminal } from '@yuants/protocol';
import { catchError, defer, from, map, mergeMap, timeout } from 'rxjs';
import { FeishuClient } from './api';

const APP_ID = process.env.APP_ID!;
const APP_SECRET = process.env.APP_SECRET!;
const EMERGENCY_RECEIVER_ID = process.env.EMERGENCY_RECEIVER_ID!;
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
    message_id?: string;
    user_id?: string;
    msg_type: string;
    content: string;
    uuid?: string;
    urgent?: string;
  },
  {
    message_id: string;
  }
>(
  'Feishu/Send',
  {
    type: 'object',
    required: ['msg_type', 'content'],
    properties: {
      message_id: { type: 'string' },
      user_id: { type: 'string' },
      msg_type: { type: 'string' },
      content: { type: 'string' },
      uuid: { type: 'string' },
      urgent: { type: 'string', enum: ['app', 'sms', 'phone'] },
    },
  },
  (msg) => from(client.sendMessage(msg.req)).pipe(map((data) => ({ res: { code: 0, message: 'OK', data } }))),
);
