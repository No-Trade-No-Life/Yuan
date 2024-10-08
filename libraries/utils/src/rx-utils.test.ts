import { from, interval, mergeMap, of, take, toArray, zipWith } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { listWatchEvent, rateLimitMap } from './rx-utils';

const testScheduler = new TestScheduler((actual, expected) => {
  expect(actual).toStrictEqual(expected);
});

describe('rx-utils', () => {
  it('rate limit should work', (done) => {
    const e1 = interval(50).pipe(take(10));
    const expected$ = from([true, true, false, true, false, true, false, true, false, true]);
    e1.pipe(
      rateLimitMap(
        (obj) => of(true),
        (obj) => of(false),
        {
          count: 1,
          period: 100,
        },
      ),
      zipWith(expected$),
    ).subscribe({
      next: ([a, e]) => {
        expect(a).toBe(e);
      },
      complete: () => {
        done();
      },
    });
  });
  it('mergeMap testing', () => {
    testScheduler.run((helpers) => {
      const { cold, time, expectObservable } = helpers;
      const e1 = cold(' -abcde-f---|');
      const expected = '-a0a0a-0---|';
      expectObservable(
        e1.pipe(
          //
          mergeMap((v, index) => (index % 2 === 0 ? cold('a|') : cold('0|'))),
        ),
      ).toBe(expected);
      // expectSubscriptions(e1.subscriptions).toBe(e1subs);
    });
  });
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
describe('list watch', () => {
  it('new items coming behavior', (done) => {
    const source$ = from([[0, 1, 2, 3, 4]]);
    source$
      .pipe(
        //
        listWatchEvent(),
        toArray(),
      )
      .subscribe((events) => {
        expect(events).toEqual([
          [
            [undefined, 0],
            [undefined, 1],
            [undefined, 2],
            [undefined, 3],
            [undefined, 4],
          ],
        ]);
        done();
      });
  });
  it('item deleted', (done) => {
    const source$ = from([[0, 1, 2, 3, 4], [0]]);
    source$
      .pipe(
        //
        listWatchEvent(),
        toArray(),
      )
      .subscribe((events) => {
        // expect(true).toBe(true);
        expect(events).toEqual([
          [
            [undefined, 0],
            [undefined, 1],
            [undefined, 2],
            [undefined, 3],
            [undefined, 4],
          ],
          [
            [1, undefined],
            [2, undefined],
            [3, undefined],
            [4, undefined],
          ],
        ]);
        done();
      });
  });
});

describe('group watch', () => {});
