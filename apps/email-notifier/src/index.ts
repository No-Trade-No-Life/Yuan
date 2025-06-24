import { formatTime } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import Imap, { ImapMessageAttributes } from 'imap';
import { simpleParser } from 'mailparser';
import { createTransport } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import {
  Observable,
  combineLatest,
  defer,
  delayWhen,
  from,
  mergeMap,
  repeat,
  retry,
  tap,
  toArray,
} from 'rxjs';
import './models/Email';

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

  Terminal.fromNodeEnv().provideService(
    'Email/Send',
    {
      required: ['from'],
      properties: {
        from: {
          type: 'string',
          const: process.env.EMAIL_USER,
        },
        to: {
          type: 'string',
        },
        subject: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        html: {
          type: 'string',
        },
      },
    },
    async (msg) => {
      const options = msg.req as Mail.Options;
      const info = await transporter.sendMail(options);
      return { res: { code: 0, message: 'OK', data: info } };
    },
  );
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
                address: process.env.EMAIL_USER!,
                uid: `${attrs.uid}`,
                attrs,
                body: await simpleParser(body),
              })),
              toArray(),
              delayWhen((arr) =>
                from(
                  requestSQL(
                    Terminal.fromNodeEnv(),
                    buildInsertManyIntoTableSQL(arr, 'email', { ignoreConflict: true }),
                  ),
                ),
              ),
              tap((arr) => console.info(formatTime(Date.now()), 'Email Written', arr.length)),
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
