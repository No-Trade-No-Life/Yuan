import { useObservableState } from 'observable-hooks';
import { combineLatest, map, Observable, shareReplay } from 'rxjs';
import { createFileSystemBehaviorSubject } from '../FileSystem';

export const DarkModeSetting$ = createFileSystemBehaviorSubject<'dark' | 'light' | 'auto'>(
  'dark-mode-setting',
  'auto',
);

const systemDarkMode$ = new Observable<boolean>((subscriber) => {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  function matchMode(e: any) {
    if (e.matches) {
      subscriber.next(true);
    } else {
      subscriber.next(false);
    }
  }
  matchMode(mql);

  mql.addEventListener('change', matchMode);
  return () => {
    mql.removeEventListener('change', matchMode);
  };
}).pipe(
  //
  shareReplay(1),
);

export const isDarkMode$ = combineLatest([DarkModeSetting$, systemDarkMode$]).pipe(
  map(([setting, system]) => {
    console.info('DarkModeSetting$', setting, system);
    if (setting === 'auto') {
      return system;
    }
    return setting === 'dark';
  }),
  shareReplay(1),
);

export const useIsDarkMode = (): boolean => useObservableState(isDarkMode$) || false;
