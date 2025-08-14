import { dirname } from 'path-browserify';
import { BehaviorSubject, defaultIfEmpty, delayWhen, filter, from, map, switchMap, tap } from 'rxjs';
import { FsBackend$, fs } from '../FileSystem';

export const createFileSystemBehaviorSubject = <T>(key: string, initialValue: T) => {
  const filename = `/.Y/states/${key}.json`;
  const theDirname = dirname(filename);
  const subject$ = new BehaviorSubject<T | undefined>(undefined);
  // read when fsBackend ready
  FsBackend$.pipe(
    switchMap(() =>
      from(fs.readFile(filename)).pipe(
        map((x) => JSON.parse(x)),
        defaultIfEmpty(initialValue),
      ),
    ),
    tap((x) => console.info('createFileSystemBehaviorSubject', key, x)),
    tap((x) => subject$.next(x)),
  ).subscribe();
  // write when value changes
  subject$
    .pipe(
      filter((v) => v !== undefined),
      delayWhen(() => from(fs.ensureDir(theDirname))),
      switchMap((v) => fs.writeFile(filename, JSON.stringify(v, null, 2))),
    )
    .subscribe();
  return subject$;
};
