import { encodePath, formatTime } from '@yuants/data-model';
import { listWatch } from '@yuants/utils';
import {
  bufferTime,
  defer,
  filter,
  map,
  mergeAll,
  mergeMap,
  Observable,
  repeat,
  retry,
  shareReplay,
  Subject,
} from 'rxjs';
import { TelegramClient } from 'telegram';
import { UpdateConnectionState } from 'telegram/network';
import { terminal } from './terminal';

const encodeId = (tgId: any) => {
  if (tgId.className === 'PeerUser') {
    return encodePath('PeerUser', tgId.userId);
  }
  if (tgId.className === 'PeerChat') {
    return encodePath('PeerChat', tgId.chatId);
  }
  if (tgId.className === 'PeerChannel') {
    return encodePath('PeerChannel', tgId.channelId);
  }
  throw new Error(`Unknown peer type: ${tgId.className}`);
};

const telegramAccounts$ = defer(() =>
  terminal.requestForResponse('SQL', {
    query: `select * from telegram_monitor_accounts`,
  }),
).pipe(
  map((v) => v.data as { account_id: string; string_session: string; phone_number: string }[]),
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);
const message$ = new Subject<ITelegramMessage>();

terminal.provideChannel<ITelegramMessage>({ const: encodePath('Telegram/Monitor') }, () => message$);

telegramAccounts$
  .pipe(
    listWatch(
      (v) => v.account_id,
      (account) =>
        defer(async () => {
          console.info(formatTime(Date.now()), `account ${account.account_id} client is creating`);
          const client = new TelegramClient(
            account.string_session,
            +process.env.APP_ID!,
            process.env.APP_HASH!,
            {},
          );
          await client.connect();
          client.addEventHandler((event) => {
            const myId = encodePath('PeerUser', account.account_id);
            if (event instanceof UpdateConnectionState) return;
            if (event.className === 'UpdateUserStatus') return;
            const raw_data = JSON.stringify(event);
            console.info(formatTime(Date.now()), raw_data);

            // 私聊
            if (event.className === 'UpdateShortMessage') {
              const oppositeUserId = encodePath('PeerUser', event.userId);
              message$.next({
                message_id: `${event.id}`,
                created_at: formatTime(event.date * 1000),
                chat_id: event.out ? oppositeUserId : myId,
                sender_id: event.out ? myId : oppositeUserId,
                message: event.message,
                raw_data,
              });
            }

            // 私聊和群组的消息编辑
            if (event.className === 'UpdateEditMessage') {
            }

            // 频道的消息编辑
            if (event.className === 'UpdateEditChannelMessage') {
            }

            // 群组
            if (event.className === 'UpdateShortChatMessage') {
              message$.next({
                message_id: `${event.id}`,
                created_at: formatTime(event.date * 1000),
                chat_id: encodePath('PeerChat', event.chatId),
                sender_id: encodePath('PeerUser', event.fromId),
                message: event.message,
                raw_data,
              });
            }

            // 私聊/群组的消息 (富文本格式)
            if (event.className === 'UpdateNewMessage') {
              message$.next({
                message_id: `${event.message.id}`,
                created_at: formatTime(event.message.date * 1000),
                chat_id: encodeId(event.message.peerId),
                sender_id: encodeId(event.message.fromId),
                message: event.message.message,
                raw_data,
              });
            }

            // 频道消息
            if (event.className === 'UpdateNewChannelMessage' && event.message.className === 'Message') {
              message$.next({
                message_id: `${event.message.id}`,
                created_at: formatTime(event.message.date * 1000),
                chat_id: encodeId(event.message.peerId),
                // if fromId is null, use peerId as sender_id
                sender_id: encodeId(event.message.fromId || event.message.peerId),
                message: event.message.message,
                raw_data,
              });
            }
          });
          return new Observable<void>(() => {
            return () => {
              console.info(formatTime(Date.now()), `account ${account.account_id} client is disconnecting`);
              client.disconnect();
            };
          });
        }).pipe(mergeAll()),
      (a, b) => a.string_session === b.string_session,
    ),
  )
  .subscribe();

interface ITelegramMessage {
  message_id: string;
  created_at: string;
  chat_id: string;
  sender_id: string;
  message: string;
  raw_data: string;
}
message$
  .pipe(
    bufferTime(1000),
    filter((messages) => messages.length > 0),
    mergeMap((messages) =>
      defer(() =>
        terminal.requestForResponse('SQL', {
          query: `
      insert into telegram_messages (message_id, created_at, chat_id, sender_id, message, raw_data) 
      values ${messages
        .map(
          (temp1) =>
            `('${temp1.message_id}', '${temp1.created_at}', '${temp1.chat_id}', '${temp1.sender_id}', '${temp1.message}', '${temp1.raw_data}')`,
        )
        .join(',')}`,
        }),
      ).pipe(retry({ delay: 5000 })),
    ),
  )
  .subscribe();

message$.subscribe(console.info);
