import { firstValueFrom, Observable, Subject } from 'rxjs';

interface Cons<T> {
  v: T;
  next: Cons<T> | null;
}

class LinkedQueue<T> {
  private head: Cons<T> | null = null;
  private tail: Cons<T> | null = null;

  enqueue(value: T): void {
    const newNode: Cons<T> = { v: value, next: null };
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      this.head.next = newNode;
      this.head = newNode;
    }
  }

  dequeue(): T | null {
    if (this.tail === null) {
      return null;
    } else {
      const value = this.tail.v;
      this.tail = this.tail.next;
      if (this.tail === null) {
        this.head = null;
      }
      return value;
    }
  }

  isEmpty(): boolean {
    return this.head === null;
  }
}

/**
 * convert an observable to an async iterable.
 * a queue is needed when converting a push-based stream(observable) to a pull-based stream(async iterable).
 *
 * @param source - the observable to convert
 * @returns an async iterable
 *
 * @public
 */
export const observableToAsyncIterable = <T>(source: Observable<T>): AsyncIterable<T> => {
  return {
    [Symbol.asyncIterator]() {
      let done: boolean = false;
      let err: any = undefined;

      const queue = new LinkedQueue<T>();
      const observableAction$ = new Subject<void>();
      const sub = source.subscribe({
        error: (e) => {
          err = e;
          done = true;
          observableAction$.next();
        },
        next: (v) => {
          queue.enqueue(v);
          observableAction$.next();
        },
        complete: () => {
          done = true;
          observableAction$.next();
        },
      });
      return {
        async next() {
          if (queue.isEmpty() && !done) {
            await firstValueFrom(observableAction$);
          }
          if (queue.isEmpty()) {
            if (err !== undefined) {
              throw err;
            }
            return {
              done: true,
              value: undefined,
            };
          }
          const value = queue.dequeue()!;
          return {
            done: false,
            value,
          };
        },
        async return() {
          sub.unsubscribe();
          return {
            done: true,
            value: undefined,
          };
        },
      };
    },
  };
};
