import {
  catchError,
  delayWhen,
  EMPTY,
  endWith,
  expand,
  ignoreElements,
  map,
  mergeMap,
  Observable,
  ObservableInput,
  of,
  takeUntil,
  timer,
} from 'rxjs';

// 循环执行任务
export const createCyclicTask = <T>(ctx: {
  data: T[];
  task: (task: T) => ObservableInput<any>;
  dispose$: Observable<any>;
  interval: number;
}) => {
  of(0)
    .pipe(
      expand(
        (idx) =>
          of(idx).pipe(
            map((x) => {
              if (ctx.data.length === 0) throw '';
              return ctx.data[x % ctx.data.length];
            }),
            mergeMap((task) => ctx.task(task)),
            catchError(() => EMPTY),
            ignoreElements(),
            endWith(idx + 1),
            delayWhen(() => timer(ctx.interval)),
          ),
        1,
      ),
      takeUntil(ctx.dispose$),
    )
    .subscribe();
};
