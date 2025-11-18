import { Subject, Subscription, filter, mergeMap, timer } from 'rxjs';

type QueueTask = {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

interface IRateLimitChannel {
  queue: QueueTask[];
  limit: number;
  subject: Subject<QueueTask>;
  queueSubscription: Subscription;
  timerSubscription: Subscription;
  activeCount: number;
}

export class RateLimiter {
  private channels = new Map<string, IRateLimitChannel>();

  schedule<T>(key: string, limit: number, periodMs: number, execute: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(limit) || limit <= 0) {
      return execute();
    }
    const channel = this.ensureChannel(key, limit, periodMs);

    return new Promise<T>((resolve, reject) => {
      channel.queue.push({
        execute,
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  private ensureChannel(key: string, limit: number, periodMs: number): IRateLimitChannel {
    if (this.channels.has(key)) {
      return this.channels.get(key)!;
    }
    const subject = new Subject<QueueTask>();
    const channel: IRateLimitChannel = {
      queue: [],
      limit,
      subject,
      queueSubscription: subject.subscribe((task) => {
        channel.activeCount++;
        task
          .execute()
          .then((value) => task.resolve(value))
          .catch((error) => task.reject(error))
          .finally(() => {
            channel.activeCount--;
            if (channel.queue.length === 0 && channel.activeCount === 0) {
              this.disposeChannel(key);
            }
          });
      }),
      timerSubscription: timer(0, periodMs)
        .pipe(
          filter(() => channel.queue.length > 0),
          mergeMap(() => channel.queue.splice(0, channel.limit)),
        )
        .subscribe(subject),
      activeCount: 0,
    };

    this.channels.set(key, channel);
    return channel;
  }

  private disposeChannel(key: string) {
    const channel = this.channels.get(key);
    if (!channel) return;
    channel.queueSubscription.unsubscribe();
    channel.timerSubscription.unsubscribe();
    channel.subject.complete();
    this.channels.delete(key);
  }
}

export const rateLimiter = new RateLimiter();
