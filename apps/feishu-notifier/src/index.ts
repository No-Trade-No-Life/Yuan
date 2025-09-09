import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/notify';
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
          client.sendFeishuMessage(
            v,
            `CRITICAL ALERTING: HOST connection lost\nHOST_URL: ${terminal.host_url}`,
          ),
        ),
      ),
    ),
  )
  .subscribe();

terminal.provideService<{
  /**
   * Receiver ID parsed by Transport
   * 由 Transport 解析的接收者 ID
   */
  receiver_id: string;
  /**
   * Message content
   * 消息正文
   */
  message: string;
}>(
  'Notify',
  {
    type: 'object',
    required: ['type', 'receiver_id', 'message'],
    properties: {
      type: { const: 'feishu' },
      receiver_id: { type: 'string' },
      message: { type: 'string' },
    },
  },
  (msg) =>
    from(client.sendFeishuMessage(msg.req.receiver_id, msg.req.message)).pipe(
      map(() => ({ res: { code: 0, message: 'OK' } })),
    ),
);
