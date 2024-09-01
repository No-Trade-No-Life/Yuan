import { useObservableState } from 'observable-hooks';
import { Observable } from 'rxjs';
import { createPersistBehaviorSubject } from '../BIOS';

export const isDarkMode$ = createPersistBehaviorSubject('dark-mode', false);

isDarkMode$.subscribe((isDark) => {
  if (isDark) {
    if (!document.body.hasAttribute('theme-mode')) {
      document.body.setAttribute('theme-mode', 'dark');
    }
  } else {
    if (document.body.hasAttribute('theme-mode')) {
      document.body.removeAttribute('theme-mode');
    }
  }
});

// Follow system dark mode
if (false) {
  new Observable<boolean>((subscriber) => {
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
  }).subscribe((v) => {
    isDarkMode$.next(v);
  });
}

export const useIsDarkMode = (): boolean => useObservableState(isDarkMode$) || false;
