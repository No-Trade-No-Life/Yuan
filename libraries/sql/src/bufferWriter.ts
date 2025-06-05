import { catchError, defer, EMPTY, exhaustMap, interval, Observable, takeUntil, tap } from 'rxjs';

export interface IBufferWriter<T> {
  buffer: T[];
  state: {
    total: number;
    written: number;
    writing: number;
    complete: number;
    error: number;
    last_written: T | null;
  };
}

export const createBufferWriter = <T>(ctx: {
  /**
   * 写入间隔 (ms)
   */
  writeInterval: number;
  /**
   * 批量写入操作
   *
   * - resolved: 数据全部写入成功
   * - rejected: 数据全部写入失败
   *
   * @param data
   * @returns
   */
  bulkWrite: (data: T[]) => Promise<any>;

  /**
   * 数据流
   */
  data$: Observable<T>;

  /**
   * 销毁信号
   */
  dispose$: Observable<any>;
}): IBufferWriter<T> => {
  const state: IBufferWriter<T>['state'] = {
    total: 0,
    written: 0,
    writing: 0,
    complete: 0,
    error: 0,
    last_written: null,
  };
  const buffer: T[] = [];

  ctx.data$
    .pipe(
      takeUntil(ctx.dispose$),
      tap((data) => {
        buffer.push(data);
        state.total++;
      }),
    )
    .subscribe();

  // 每秒钟写入一次
  interval(ctx.writeInterval)
    .pipe(
      takeUntil(ctx.dispose$),
      exhaustMap(() => {
        if (buffer.length === 0) return EMPTY;
        const toWrite = [...buffer];
        const length = toWrite.length;
        state.writing = length;
        return defer(() => ctx.bulkWrite(toWrite)).pipe(
          tap({
            complete: () => {
              state.written += length;
              state.writing = 0;
              state.last_written = toWrite[length - 1];
              state.complete++;
              buffer.splice(0, length);
            },
            error: () => {
              state.error++;
            },
          }),
          catchError(() => EMPTY),
        );
      }),
    )
    .subscribe();

  return { buffer, state };
};
