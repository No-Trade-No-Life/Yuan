import { formatTime, IAccountInfo, IPeriod, ITick } from '@yuants/data-model';
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
import { Terminal } from './terminal';

declare module './services' {
  /**
   * - SubscribeChannel has been loaded
   * - 订阅频道接口已载入
   */
  interface IService {
    SubscribeChannel: {
      req: {
        type: string;
        channel_id: string;
      };
      frame: {
        value: any;
      };
      res: IResponse<void>;
    };
  }
}

/**
 * Channel Types
 * 频道类型
 * @public
 */
export interface IChannelTypes {
  AccountInfo: {
    value: IAccountInfo;
  };
  Tick: {
    value: ITick;
  };
  Period: {
    value: IPeriod;
  };
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
    'SubscribeChannel',
    {
      type: 'object',
      required: ['type', 'channel_id'],
      properties: {
        type: { const: type },
        channel_id: channelSchema,
      },
    },
    (msg) => {
      const channel_id = msg.req.channel_id;
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
    defer(() => terminal.requestService('SubscribeChannel', { type, channel_id })).pipe(
      //
      map((msg) => msg.frame?.value as IChannelTypes[T]['value'] | undefined),
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
