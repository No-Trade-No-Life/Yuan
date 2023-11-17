import { Observable } from 'rxjs';

// 1  2  3  4  5  6  7  8  9  10
//          4     6  7  8  9  10  11
//    2  3  4  5  6

// [1], [2,2], [3,3], [4,4,4], [5,5], [6,6,6], [7,7], [8,8], [9,9], [10,10], [11]

export const mergeSort = <T>(
  inputs: Observable<T>[],
  comparator: (a: T, b: T) => number,
): Observable<T[]> => {
  return new Observable<T[]>((subscriber) => {
    const queues: T[][] = Array.from({ length: inputs.length }, () => []);
    const isComplete: boolean[] = Array.from({ length: inputs.length }, () => false);
    const run = () => {
      while (queues.every((queue, i) => queue.length !== 0 || isComplete[i])) {
        const min: T | undefined = queues.reduce((acc, queue) => {
          if (acc === undefined) {
            return queue[0];
          }
          if (queue[0] === undefined) {
            return acc;
          }
          if (comparator(acc, queue[0]) < 0) {
            return acc;
          } else {
            return queue[0];
          }
        }, queues[0][0]);

        if (min === undefined) {
          subscriber.complete();
          return;
        }

        const toEmit: T[] = [];
        for (let i = 0; i < queues.length; i++) {
          if (queues[i].length !== 0 && comparator(queues[i][0], min) === 0) {
            toEmit.push(queues[i].shift()!);
          }
        }
        subscriber.next(toEmit);
      }
    };
    const subscriptions = inputs.map((input, i) => {
      return input.subscribe({
        next: (v) => {
          queues[i].push(v);
          run();
        },
        error: (err) => subscriber.error(err),
        complete: () => {
          isComplete[i] = true;
          run();
        },
      });
    });
    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    };
  });
};
