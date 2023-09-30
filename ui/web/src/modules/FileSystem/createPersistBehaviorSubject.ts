import { get, set } from 'idb-keyval';
import { BehaviorSubject } from 'rxjs';

export const createPersistBehaviorSubject = <T>(key: string, initialValue: T) => {
  const subject$ = new BehaviorSubject<T | undefined>(undefined);
  get(key).then((value) => {
    if (value !== undefined) {
      subject$.next(value);
    } else {
      subject$.next(initialValue);
    }
    subject$.subscribe((newVal) => {
      set(key, newVal);
    });
  });
  return subject$;
};
