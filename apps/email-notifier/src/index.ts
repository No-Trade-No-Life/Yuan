import { IDataRecordTypes, formatTime, getDataRecordWrapper } from '@yuants/data-model';
import { Terminal, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/notify';
import Imap, { ImapMessageAttributes } from 'imap';
import { simpleParser } from 'mailparser';
import { createTransport } from 'nodemailer';
import {
  Observable,
  combineLatest,
  defer,
  delayWhen,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  tap,
  toArray,
} from 'rxjs';
import './models/Email';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `Email/${process.env.EMAIL_USER}`,
  name: 'Email',
});

if (process.env.SMTP_HOST) {
  const transporter = createTransport({
    host: process.env.SMTP_HOST!,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: (process.env.SMTP_PASS || process.env.EMAIL_PASS)!,
    },
  });

  terminal.provideService('Notify', {}, async (msg) => {
    const [subject, ...content] = msg.req.message.split('\n');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER!,
      to: msg.req.receiver_id,
      subject,
      text: content.join('\n'),
    });
    console.info(formatTime(Date.now()), 'SendEmail', msg.trace_id, info.messageId, info.response);
    return { res: { code: 0, message: 'OK' } };
  });
}

if (process.env.IMAP_HOST) {
  defer(
    () =>
      new Observable<Imap>((observer) => {
        const imap = new Imap({
          user: process.env.EMAIL_USER!,
          password: (process.env.IMAP_PASS || process.env.EMAIL_PASS)!,
          host: process.env.IMAP_HOST!,
          port: 993,
          tls: true,
        });
        imap.once('ready', () => {
          observer.next(imap);
          observer.complete();
        });
        imap.once('error', (err: any) => {
          observer.error(err);
        });
        imap.connect();
      }),
  )
    .pipe(
      tap({
        subscribe: () => console.info(formatTime(Date.now()), 'IMAP Connecting'),
        next: () => console.info(formatTime(Date.now()), 'IMAP Connected'),
        error: (err) => console.info(formatTime(Date.now()), 'IMAP Connection Error', err),
      }),
      mergeMap((imap) =>
        from(
          new Promise<Imap.Box>((resolve, reject) => {
            imap.openBox('INBOX', (err, box) => {
              if (err) {
                reject(err);
              } else {
                resolve(box);
              }
            });
          }),
        ).pipe(
          tap({
            subscribe: () => console.info(formatTime(Date.now()), 'Box Opening'),
            next: (box) => console.info(formatTime(Date.now()), 'Box Opened', box.messages.total),
          }),
          mergeMap((box) =>
            defer(
              () =>
                new Observable<Imap.ImapMessage>((observer) => {
                  const f = imap.seq.fetch(`${box.messages.total}:*`, {
                    bodies: '',
                  });
                  f.on('message', (msg, uid) => {
                    observer.next(msg);
                  });
                  f.once('error', (err) => {
                    observer.error(err);
                  });
                  f.once('end', () => {
                    observer.complete();
                  });
                }),
            ).pipe(
              mergeMap((msg) =>
                combineLatest([
                  new Observable<ImapMessageAttributes>((observer) => {
                    msg.once('attributes', (attrs) => {
                      observer.next(attrs);
                      observer.complete();
                    });
                  }),
                  new Observable<string>((observer) => {
                    let buffer = '';
                    msg.on('body', (stream) => {
                      stream.on('data', (chunk) => {
                        buffer += chunk.toString('utf8');
                      });
                      stream.once('end', () => {
                        observer.next(buffer);
                        observer.complete();
                      });
                    });
                  }),
                ]),
              ),
              mergeMap(async ([attrs, body]) => ({
                attrs,
                body: await simpleParser(body),
              })),
              map((x): IDataRecordTypes['email'] => ({ ...x, address: process.env.EMAIL_USER! })),
              map((x) => getDataRecordWrapper('email')!(x)),
              toArray(),
              map((arr) => arr.sort((a, b) => a.created_at! - b.created_at!)),
              delayWhen((arr) => from(writeDataRecords(terminal, arr))),
              tap((arr) => console.info(formatTime(Date.now()), 'Email Writen', arr.length)),
              repeat({
                delay: 5_000,
              }),
              retry({
                delay: 5_000,
              }),
            ),
          ),
        ),
      ),
      // Retry when connection error
      retry({ delay: 30_000 }),
    )
    .subscribe();
}
