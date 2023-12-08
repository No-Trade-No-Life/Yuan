import { formatTime } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/notify';
import { createTransport } from 'nodemailer';
import { defer, map, tap } from 'rxjs';

const HV_URL = process.env.HV_URL || 'ws://localhost:8888';

const TERMINAL_ID = process.env.TERMINAL_ID || `notifier/email/${process.env.SMTP_USER}`;
const term = new Terminal(HV_URL, { terminal_id: TERMINAL_ID, name: 'Notifier Email', status: 'OK' });

const transporter = createTransport({
  host: process.env.SMTP_HOST!,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

term.provideService('Notify', {}, (msg) => {
  // extract first line as Subject
  const [subject, ...content] = msg.req.message.split('\n');
  return defer(() =>
    transporter.sendMail({
      from: process.env.SMTP_USER!,
      to: msg.req.receiver_id,
      subject,
      text: content.join('\n'),
    }),
  ).pipe(
    //
    tap((info) => {
      console.info(formatTime(Date.now()), 'SendEmail', msg.trace_id, info.messageId, info.response);
    }),
    map(() => ({ res: { code: 0, message: 'OK' } })),
  );
});
