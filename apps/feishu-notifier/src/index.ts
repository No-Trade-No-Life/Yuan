import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/notify';
import { catchError, defer, from, map, mergeMap, timeout } from 'rxjs';
import { FeishuClient } from './api';

const TERMINAL_ID = process.env.TERMINAL_ID || `notifier/feishu/${process.env.APP_ID!}`;
const APP_ID = process.env.APP_ID!;
const APP_SECRET = process.env.APP_SECRET!;
const EMERGENCY_RECEIVER_ID = process.env.EMERGENCY_RECEIVER_ID!;
const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: TERMINAL_ID,
  name: 'Notifier Feishu',
});

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

terminal.provideService('Notify', {}, (msg) =>
  from(client.sendFeishuMessage(msg.req.receiver_id, msg.req.message)).pipe(
    map(() => ({ res: { code: 0, message: 'OK' } })),
  ),
);
