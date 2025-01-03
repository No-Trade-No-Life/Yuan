import { concatWith, firstValueFrom, from, interval, share, take, tap, throwError, timer } from 'rxjs';
import { observableToAsyncIterable } from './async-iterator-interop';

describe('async-iterator-interop', () => {
  it('sync observable to async iterable', async () => {
    const expected = [1, 2, 3, 4];
    const actual: number[] = [];
    const iterable = observableToAsyncIterable(from(expected));
    for await (const i of iterable) {
      actual.push(i);
    }
    expect(actual).toEqual(expected);
  });

  it('async observable to async iterable', async () => {
    const expected = [0, 1, 2, 3];
    const actual: number[] = [];
    const source = interval(10).pipe(take(4));
    const asyncIterable = observableToAsyncIterable(source);
    for await (const i of asyncIterable) {
      actual.push(i);
    }
    expect(actual).toEqual(expected);
  });

  it('hot observable to async iterable', async () => {
    const expected = [0, 1, 2, 3];
    const actual: number[] = [];
    const source = interval(10).pipe(take(4), share());
    const asyncIterable = observableToAsyncIterable(source);
    source.subscribe();
    for await (const i of asyncIterable) {
      await firstValueFrom(timer(15));
      actual.push(i);
    }
    expect(actual).toEqual(expected);
  });

  it('error observable to async iterable', async () => {
    const source = interval(10).pipe(
      take(4),
      concatWith(throwError(() => new Error('error!'))),
      concatWith(from([1, 2, 3, 4])),
    );
    const asyncIterable = observableToAsyncIterable(source);
    const iterate = async () => {
      for await (const i of asyncIterable) {
      }
    };
    await expect(iterate()).rejects.toThrow(Error);
  });

  it('break and release resource', async () => {
    let count = 0;
    const source = interval(10).pipe(
      tap(() => {
        count++;
        console.info('still there!');
      }),
    );
    // ISSUE: note that the `return` method will be called when the loop is broken.
    // so the observable should be unsubscribed.
    for await (const i of observableToAsyncIterable(source)) {
      break;
    }
    await firstValueFrom(timer(100));
    expect(count).toEqual(1);
  });
});
