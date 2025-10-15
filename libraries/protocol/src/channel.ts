import { encodePath, formatTime } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import {
  defer,
  filter,
  first,
  from,
  interval,
  map,
  mergeWith,
  Observable,
  ObservableInput,
  repeat,
  retry,
  share,
  takeUntil,
  tap,
} from 'rxjs';
import { Terminal } from './terminal';
import { PromRegistry } from './metrics';

const MetricChannelPayloadCounter = PromRegistry.create(
  'counter',
  'terminal_channel_payload_total',
  'Count of payload messages sent through channels',
);

const MetricChannelSubscribersGauge = PromRegistry.create(
  'gauge',
  'terminal_channel_subscribers',
  'Number of subscribers for each channel',
);

/**
 * Channel Manager
 *
 * @public
 */
export class TerminalChannel {
  constructor(public terminal: Terminal) {}

  /**
   * cached published observable, multiple subscriptions share the same observable
   *
   * shared observable is to be cold when all subscriptions are closed
   */
  private _mapTypeAndChannelIdToPublishedObservable$ = new Map<string, Observable<any>>();

  private _mapTypeAndChannelIdToSubscribedObservable$ = new Map<string, Observable<any>>();

  /**
   * Publish channel
   * 发布频道
   *
   * @param type - channel type
   * @param channelSchema - channel schema, default is `{ const: '' }`
   * @param handler - handler to provide observable
   * @public
   */
  publishChannel<T>(
    type: string,
    channelSchema: JSONSchema7 | undefined,
    handler: (channel_id: string) => ObservableInput<T>,
  ) {
    return this.terminal.server.provideService<{
      channel_id: string;
    }>(
      // ISSUE: 将频道类型作为服务名为了优化方法索引速度，因为频道类型是常量，主机内会有很多不同类型的频道
      encodePath('SubscribeChannel', type),
      {
        type: 'object',
        required: ['channel_id'],
        properties: {
          channel_id: {
            allOf: [
              //
              { type: 'string' },
              channelSchema || { const: '' },
            ],
          },
        },
      },
      (msg) => {
        const channel_id = msg.req.channel_id;

        const typeAndChannelId = encodePath(type, channel_id);
        if (!this._mapTypeAndChannelIdToPublishedObservable$.get(typeAndChannelId)) {
          this._mapTypeAndChannelIdToPublishedObservable$.set(
            typeAndChannelId,
            defer(() => handler(channel_id)).pipe(
              //
              map((value) => ({ frame: { value } })),
              tap({
                next: () => {
                  MetricChannelPayloadCounter.inc({ type, channel_id });
                },
              }),
              mergeWith(interval(30_000).pipe(map(() => ({})))), // ISSUE: Heartbeat KeepAlive, Ensure the connection is not closed
              tap({
                subscribe: () => {
                  if (this.terminal.options.verbose) {
                    console.info(
                      formatTime(Date.now()),
                      'ChannelPublisher',
                      `type=${type} channel_id=${channel_id} is initialized`,
                    );
                  }
                },
                finalize: () => {
                  if (this.terminal.options.verbose) {
                    console.info(
                      formatTime(Date.now()),
                      'ChannelPublisher',
                      `type=${type} channel_id=${channel_id} is closed`,
                    );
                  }
                  this._mapTypeAndChannelIdToPublishedObservable$.delete(typeAndChannelId);
                },
              }),
              // shared observable is to be cold when all subscriptions are closed
              share({ resetOnRefCountZero: true }),
            ),
          );
        }
        return this._mapTypeAndChannelIdToPublishedObservable$.get(typeAndChannelId)!.pipe(
          tap({
            subscribe: () => {
              if (this.terminal.options.verbose) {
                console.info(
                  formatTime(Date.now()),
                  'ChannelPublisher',
                  `type=${type} channel_id=${channel_id} is subscribed by ${msg.source_terminal_id}`,
                );
              }
              MetricChannelSubscribersGauge.inc({ type, channel_id });
            },
            finalize: () => {
              if (this.terminal.options.verbose) {
                console.info(
                  formatTime(Date.now()),
                  'ChannelPublisher',
                  `type=${type} channel_id=${channel_id} is unsubscribed by ${msg.source_terminal_id}`,
                );
              }
              MetricChannelSubscribersGauge.dec({ type, channel_id });
            },
          }),
          // 直到发起订阅的终端不在主机中，自动关闭频道
          takeUntil(
            from(this.terminal.terminalInfos$).pipe(
              map((x) => x.every((t) => t.terminal_id !== msg.source_terminal_id)),
              first((x) => x),
              tap(() => {
                if (this.terminal.options.verbose) {
                  console.info(
                    formatTime(Date.now()),
                    'ChannelPublisher',
                    `type=${type} channel_id=${channel_id} is auto closed because ${msg.source_terminal_id} is disposed`,
                  );
                }
              }),
            ),
          ),
        );
      },
    );
  }

  /**
   * Subscribe channel
   *
   * - **Auto Re-Subscription**: when the connection is broken, it will automatically re-subscribe
   * - **Multicast**: multiple subscriptions with same type and channel_id will share the same observable
   * - **Auto un-subscription**: When all subscriptions are closed, the channel will be automatically closed
   *
   * @param type - channel type
   * @param channel_id - channel id, default is empty string
   *
   * @public
   */
  subscribeChannel<T>(type: string, channel_id: string = ''): Observable<T> {
    const typeAndChannelId = encodePath(type, channel_id);
    if (!this._mapTypeAndChannelIdToSubscribedObservable$.get(typeAndChannelId)) {
      this._mapTypeAndChannelIdToSubscribedObservable$.set(
        typeAndChannelId,
        defer(() =>
          this.terminal.client.requestService<{ channel_id: string }, void, { value: any }>(
            encodePath('SubscribeChannel', type),
            { channel_id },
          ),
        ).pipe(
          map((msg) => msg.frame?.value as T | undefined),
          filter((x): x is T => !!x),
          // Auto re-subscribe when the connection is broken
          repeat({ delay: 1000 }), // ISSUE: Server maybe response 504 if timeout
          retry({ delay: 1000 }), // ISSUE: Client maybe response 504 if timeout
          tap({
            subscribe: () => {
              if (this.terminal.options.verbose) {
                console.info(
                  formatTime(Date.now()),
                  'ChannelSubscriber',
                  `type=${type} channel_id=${channel_id} is open to subscribed`,
                );
              }
            },
            finalize: () => {
              if (this.terminal.options.verbose) {
                console.info(
                  formatTime(Date.now()),
                  'ChannelSubscriber',
                  `type=${type} channel_id=${channel_id} is closed`,
                );
              }
              this._mapTypeAndChannelIdToSubscribedObservable$.delete(typeAndChannelId);
            },
          }),
          // Auto close when the terminal is disposed
          takeUntil(this.terminal.dispose$),
          // shared observable is to be cold when all subscriptions are closed
          share({ resetOnRefCountZero: true }),
        ),
      );
    }

    return this._mapTypeAndChannelIdToSubscribedObservable$.get(typeAndChannelId)!;
  }
}
