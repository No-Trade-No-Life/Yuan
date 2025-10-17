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
 * 列表监听操作符 - 实现动态配置管理和资源生命周期管理的强大工具
 *
 * 该操作符专门用于监控数据列表的变化，并自动管理每个项目的处理流程。
 * 当项目被添加到列表时自动启动处理，当项目被移除时自动取消处理。
 *
 * @template T - 输入数据项的类型
 * @template K - 消费者函数返回的 Observable 发出的值的类型
 *
 * @param keyFunc - 键提取函数，用于为每个数据项生成唯一的标识符
 *                  - 类型: (item: T) => string
 *                  - 作用: 确定哪些项目是相同的，哪些是新的或已删除的
 *                  - 示例: (account) => account.account_id
 *                  - 示例: (config) => encodePath(config.table_name, config.series_id)
 *
 * @param consumer - 消费者函数，用于处理每个数据项
 *                   - 类型: (item: T) => Observable<K>
 *                   - 作用: 当项目被添加到列表时调用，返回的 Observable 会在项目被移除时自动取消订阅
 *                   - 要求: 返回的 Observable 应该在处理完成时发出值并完成
 *                   - 示例: (rule) => defer(() => writeRuleToFile(rule))
 *                   - 示例: (task) => runTask(task)
 *
 * @param comparator - 比较器函数，用于判断两个项目是否相同（可选，默认为始终返回 true）
 *                     - 类型: (a: T, b: T) => boolean
 *                     - 作用: 只有当项目真正发生变化时才重新调用消费者函数
 *                     - 示例: (a, b) => JSON.stringify(a) === JSON.stringify(b)
 *                     - 示例: (a, b) => a.updated_at === b.updated_at
 *
 * @returns 返回一个 RxJS 操作符函数，将 Observable<T[]> 转换为 Observable<K>
 *
 * @example
 * ```typescript
 * // 监控数据库中的账户配置变化，自动管理账户信息流（account-composer 用例）
 * accountConfigs$.pipe(
 *   listWatch(
 *     (config) => config.account_id,
 *     (config) => createAccountInfoStream(config),
 *     (a, b) => a.updated_at === b.updated_at
 *   )
 * ).subscribe(accountInfo => {
 *   console.log('账户信息更新:', accountInfo);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // 监控 Prometheus 规则变化，自动同步到文件系统（prometheus-rule-controller 用例）
 * ruleGroups$.pipe(
 *   listWatch(
 *     (group) => group.name,
 *     (group) => defer(async () => {
 *       await writeRuleFile(group);
 *       reloadPrometheus();
 *     }),
 *     (a, b) => JSON.stringify(a.rules) === JSON.stringify(b.rules)
 *   )
 * ).subscribe();
 * ```
 *
 * @example
 * ```typescript
 * // 监控数据收集任务配置，自动管理定时任务（series-collector 用例）
 * collectingTasks$.pipe(
 *   listWatch(
 *     (task) => encodePath(task.table_name, task.series_id),
 *     (task) => runTask(task),
 *     (a, b) => JSON.stringify(a) === JSON.stringify(b)
 *   )
 * ).subscribe();
 * ```
 *
 * @example
 * ```typescript
 * // 监控交易对配置，自动管理 WebSocket 连接（vendor-okx 用例）
 * instruments$.pipe(
 *   listWatch(
 *     (inst) => inst.instId,
 *     (inst) => createWebSocketStream(inst),
 *     (a, b) => JSON.stringify(a) === JSON.stringify(b)
 *   )
 * ).subscribe(quote => {
 *   console.log('行情更新:', quote);
 * });
 * ```
 *
 * @remarks
 * ## 工作原理
 * 1. 使用 `batchGroupBy` 将数组按 keyFunc 分组
 * 2. 对每个分组使用 `distinctUntilChanged` 避免重复处理
 * 3. 使用 `switchMapWithComplete` 确保项目被移除时取消订阅
 *
 * ## 适用场景
 * - 动态配置管理（账户、规则、任务等）
 * - 资源生命周期管理（WebSocket 连接、定时任务、服务进程等）
 * - 服务发现和负载均衡
 * - 实时数据流管理
 *
 * ## 最佳实践
 * 1. **键函数选择**: 选择合适的键函数确保唯一性
 * 2. **错误处理**: 在消费者函数中使用 `catchError` 或 `retry` 处理临时错误
 * 3. **比较器优化**: 使用合适的比较器避免不必要的重新处理
 * 4. **资源清理**: 确保消费者函数返回的 Observable 能够正确清理资源
 * 5. **异步操作**: 使用 `defer` 包装异步操作，确保每次订阅都重新执行
 *
 * ## 性能优化
 * 1. 选择合适的比较器避免不必要的重新处理
 * 2. 对于复杂对象，使用 JSON.stringify 或特定字段比较
 * 3. 避免在比较器中进行昂贵的计算
 *
 * ## 错误处理最佳实践
 * 1. 在消费者函数中使用 `catchError` 或 `retry` 处理临时错误
 * 2. 对于致命错误，让 Observable 错误终止，listWatch 会自动重新订阅
 * 3. 使用 `defer` 包装异步操作，确保每次订阅都重新执行
 *
 * ## 资源管理
 * 1. 消费者函数返回的 Observable 应该在清理时正确取消订阅
 * 2. 使用 `new Observable` 时，确保在取消订阅时清理资源
 * 3. 对于定时任务、WebSocket 连接等，确保在取消订阅时正确关闭
 *
 * ## 常见陷阱
 * 1. **内存泄漏**: 忘记在消费者函数中清理资源
 * 2. **重复处理**: 使用不合适的比较器导致不必要的重新处理
 * 3. **错误传播**: 未处理的错误可能导致整个流终止
 * 4. **热 observable**: 在多个地方订阅同一个 observable 可能导致意外行为
 *
 * ## 与 listWatchEvent 的区别
 * - `listWatch`: 专注于处理每个项目的生命周期，自动管理订阅
 * - `listWatchEvent`: 专注于检测变化事件，返回变化详情数组
 *
 * @see batchGroupBy
 * @see switchMapWithComplete
 * @see listWatchEvent
 * @public
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
