import {
  Observable,
  OperatorFunction,
  SchedulerLike,
  Subject,
  Subscription,
  concat,
  distinctUntilChanged,
  filter,
  interval,
  map,
  mergeMap,
  of,
  pairwise,
  pipe,
  tap,
} from 'rxjs';

/**
 * 同 groupBy 类似，但是会接受一整个数组，如果下一组数据中没有某个 key，会自动 complete 这个 key 的 Observable
 * @public
 */
export const batchGroupBy =
  <T>(keyFunc: (obj: T) => string) =>
  (source$: Observable<T[]>): Observable<Observable<T> & { key: string }> => {
    const groups: Record<string, Subject<T> & { key: string }> = {};
    return new Observable((subscriber) => {
      const sub = source$.subscribe({
        next: (data) => {
          const keys = new Set<string>();
          for (const item of data) {
            const key = keyFunc(item);
            if (groups[key] === undefined) {
              groups[key] = Object.assign(new Subject<T>(), { key });
              subscriber.next(groups[key]);
            }
            keys.add(key);
            groups[key].next(item);
          }
          for (const key in groups) {
            if (!keys.has(key)) {
              groups[key].complete();
              delete groups[key];
            }
          }
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
      return () => sub.unsubscribe();
    });
  };

/**
 * 同 switchMap 类似，但在整个流 Complete 的时候，会自动取消上一个 Observable 的订阅
 * @public
 */
export const switchMapWithComplete =
  <T, U>(fn: (obj: T) => Observable<U>) =>
  (source$: Observable<T>): Observable<U> => {
    return new Observable((subscriber) => {
      let lastSub: Subscription | undefined;
      const sub = source$.subscribe({
        next: (data) => {
          lastSub?.unsubscribe();
          const sub2 = fn(data).subscribe({
            next: (data) => subscriber.next(data),
            error: (err) => subscriber.error(err),
          });
          lastSub = sub2;
        },
        error: (err) => {
          lastSub?.unsubscribe();
          subscriber.error(err);
        },
        complete: () => {
          lastSub?.unsubscribe();
          subscriber.complete();
        },
      });
      return () => {
        lastSub?.unsubscribe();
        sub.unsubscribe();
      };
    });
  };

/**
 * 令牌桶算法，用于限制流量
 * @public
 */
export const rateLimitMap =
  <A, B, C>(
    fn: (obj: A) => Observable<B>,
    reject: (obj: A) => Observable<C>,
    rateLimitConfig?: {
      count: number;
      period: number;
    },
    scheduler?: SchedulerLike,
  ) =>
  (source$: Observable<A>): Observable<B | C> => {
    if (rateLimitConfig === undefined) {
      return source$.pipe(mergeMap(fn));
    }
    return new Observable((subscriber) => {
      let token = rateLimitConfig.count;
      const subs: Subscription[] = [];
      subs.push(
        interval(rateLimitConfig.period / rateLimitConfig.count, scheduler)
          .pipe(
            //
            filter(() => token < rateLimitConfig.count),
            tap(() => {
              token++;
            }),
          )
          .subscribe(),
      );
      subs.push(
        source$.subscribe({
          next: (obj) => {
            if (token <= 0) {
              reject(obj).subscribe({
                next: (obj) => subscriber.next(obj),
                error: (err) => subscriber.error(err),
              });
            } else {
              token--;
              fn(obj).subscribe({
                next: (obj) => subscriber.next(obj),
                error: (err) => subscriber.error(err),
              });
            }
          },
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        }),
      );
      return () => {
        for (const sub of subs) {
          sub.unsubscribe();
        }
      };
    });
  };

/**
 * list and watch a source of items, and apply consumer to each newly added item,
 * the consumer should return an observable that completes when the item is fully processed,
 *
 * consumer will be cancelled when the item is removed.
 *
 * @public
 * @param keyFunc - hash key function to group items
 * @param consumer - consumer function to process each item
 * @param comparator - comparator function to compare items, return true if they are the same
 * @returns
 */
export const listWatch = <T, K>(
  keyFunc: (item: T) => string,
  consumer: (item: T) => Observable<K>,
  comparator: (a: T, b: T) => boolean = () => true,
): OperatorFunction<T[], K> =>
  pipe(
    batchGroupBy(keyFunc),
    mergeMap((group) =>
      group.pipe(
        // Take first but not complete until group complete
        distinctUntilChanged(comparator),
        switchMapWithComplete(consumer),
      ),
    ),
  );

/**
 * list and watch a source of items, and apply consumer to each newly added item,
 * the consumer should return an observable that completes when the item is fully processed,
 *
 * consumer will be cancelled when the item is removed.
 *
 * @public
 * @param keyFunc - hash key function to group items
 * @param comparator - comparator function to compare items, return true if they are the same
 * @returns
 */
export const listWatchEvent =
  <T>(
    keyFunc: (item: T) => string = (v) => `${v}`,
    comparator: (a: T, b: T) => boolean = (a, b) => a === b,
  ): OperatorFunction<T[], [old: T | undefined, new: T | undefined][]> =>
  (source$) =>
    concat(of([]), source$).pipe(
      //
      map((v) => new Map(v.map((v) => [keyFunc(v), v] as [string, T]))),
      pairwise(),
      map(([oldMap, newMap]) => {
        const events: [old: T | undefined, new: T | undefined][] = [];
        for (const [key, item] of oldMap) {
          const newItem = newMap.get(key);
          if (newItem !== undefined) {
            if (!comparator(item, newItem)) {
              events.push([item, newItem]);
            }
          } else {
            events.push([item, undefined]);
          }
        }
        for (const [key, item] of newMap) {
          if (!oldMap.has(key)) {
            events.push([undefined, item]);
          }
        }
        return events;
      }),
    );
