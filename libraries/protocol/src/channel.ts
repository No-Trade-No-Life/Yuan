import { encodePath, formatTime, IAccountInfo, IPeriod, ITick } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import {
  defer,
  filter,
  first,
  from,
  map,
  Observable,
  ObservableInput,
  retry,
  share,
  takeUntil,
  tap,
} from 'rxjs';
import { ITerminalInfo } from './model';
import { Terminal } from './terminal';

/**
 * Channel Types
 * 频道类型
 * @public
 */
export interface IChannelTypes {}

declare module '.' {
  interface IChannelTypes {
    AccountInfo: {
      value: IAccountInfo;
    };
    Tick: {
      value: ITick;
    };
    Periods: {
      value: IPeriod[];
    };
    TerminalInfo: {
      value: ITerminalInfo;
    };
    TerminalInfoChangeEvent: {
      value: { new?: ITerminalInfo; old?: ITerminalInfo };
    };
  }
}

/**
 * Publish channel
 * 发布频道
 *
 * @public
 */
export const publishChannel = <T extends keyof IChannelTypes>(
  terminal: Terminal,
  type: T,
  channelSchema: JSONSchema7,
  handler: (channel_id: string) => ObservableInput<IChannelTypes[T]['value']>,
) => {
  const mapChannelIdToSubject$: Record<
    string,
    Observable<{ frame: { value: IChannelTypes[T]['value'] } }>
  > = {};
  return terminal.provideService(
    // ISSUE: 将频道类型作为服务名为了优化方法索引速度，因为频道类型是常量，主机内会有很多不同类型的频道
    encodePath('SubscribeChannel', type),
    {
      type: 'object',
      required: ['channel_id'],
      properties: {
        channel_id: channelSchema,
      },
    },
    (msg) => {
      const channel_id = (
        msg.req as {
          channel_id: string;
        }
      ).channel_id;
      return (mapChannelIdToSubject$[channel_id] ??= defer(() => handler(channel_id)).pipe(
        //
        map((value) => ({ frame: { value } })),
        tap({
          subscribe: () => {
            console.info(formatTime(Date.now()), 'Channel', `channel_id=${channel_id} is initialized`);
          },
          finalize: () => {
            console.info(formatTime(Date.now()), 'Channel', `channel_id=${channel_id} is closed`);
          },
        }),
        share({ resetOnRefCountZero: true }),
      )).pipe(
        tap({
          subscribe: () => {
            console.info(
              formatTime(Date.now()),
              'Channel',
              `channel_id=${channel_id} is subscribed by ${msg.source_terminal_id}`,
            );
          },
          finalize: () => {
            console.info(
              formatTime(Date.now()),
              'Channel',
              `channel_id=${channel_id} is unsubscribed by ${msg.source_terminal_id}`,
            );
          },
        }),
        // 直到发起订阅的终端不在主机中，自动关闭频道
        takeUntil(
          from(terminal.terminalInfos$).pipe(
            map((x) => x.every((t) => t.terminal_id !== msg.source_terminal_id)),
            first((x) => x),
          ),
        ),
      );
    },
  );
};

/**
 * Subscribe channel
 * 订阅频道
 *
 * @public
 */
export const subscribeChannel = <T extends keyof IChannelTypes>(
  terminal: Terminal,
  type: T,
  channel_id: string,
): AsyncIterable<IChannelTypes[T]['value']> => {
  return observableToAsyncIterable(
    defer(() => terminal.requestService(encodePath('SubscribeChannel', type), { channel_id })).pipe(
      //
      map((msg) => (msg.frame as { value: any })?.value as IChannelTypes[T]['value'] | undefined),
      filter((x): x is IChannelTypes[T]['value'] => !!x),
      tap({
        finalize: () => {
          console.info(formatTime(Date.now()), `Channel ${channel_id} is closed`);
        },
      }),
      retry({ delay: 1000 }),
    ),
  );
};
