import { get, set } from 'idb-keyval';
import { dirname } from 'path-browserify';
import {
  BehaviorSubject,
  catchError,
  defaultIfEmpty,
  defer,
  delayWhen,
  filter,
  from,
  map,
  switchMap,
  tap,
} from 'rxjs';
import { FsBackend$, fs } from './api';

export const createPersistBehaviorSubject = <T>(key: string, initialValue: T) => {
  const filename = `/.Y/states/${key}.json`;
  const theDirname = dirname(filename);
  const subject$ = new BehaviorSubject<T | undefined>(undefined);
  // read when fsBackend ready
  defer(() => Modules.BIOS.ready$)
    .pipe(
      switchMap(() =>
        FsBackend$.pipe(
          switchMap(() =>
            from(fs.readFile(filename)).pipe(
              map((x) => JSON.parse(x)),
              // tap({ error: (e) => console.error('createPersistBehaviorSubject', key, 'readFile Error', e) }),
              catchError(() =>
                from(get(key)).pipe(
                  //
                  filter((x) => x !== undefined),
                ),
              ),
              defaultIfEmpty(initialValue),
            ),
          ),
          tap((x) => console.info('createPersistBehaviorSubject', key, x)),
          tap((x) => subject$.next(x)),
        ),
      ),
    )
    .subscribe();
  // write when value changes
  subject$
    .pipe(
      filter((v) => v !== undefined),
      delayWhen(() => from(fs.ensureDir(theDirname))),
      // cc to idb-keyval
      tap((v) => set(key, v)),
      switchMap((v) => fs.writeFile(filename, JSON.stringify(v, null, 2))),
    )
    .subscribe();
  return subject$;
};
