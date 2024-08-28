import { get, set } from 'idb-keyval';
import { dirname } from 'path-browserify';
import { BehaviorSubject } from 'rxjs';
import { fs } from './api';

export const createPersistBehaviorSubject = <T>(key: string, initialValue: T) => {
  const subject$ = new BehaviorSubject<T | undefined>(undefined);
  get(key).then((value) => {
    if (value !== undefined) {
      subject$.next(value);
    } else {
      subject$.next(initialValue);
    }
    subject$.subscribe((newVal) => {
      const filename = `/.Y/states/${key}.json`;
      fs.ensureDir(dirname(filename)).then(() => fs.writeFile(filename, JSON.stringify(newVal)));
      set(key, newVal);
    });
  });
  return subject$;
};
