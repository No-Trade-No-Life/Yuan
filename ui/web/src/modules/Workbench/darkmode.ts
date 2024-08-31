import { useObservableState } from 'observable-hooks';
import { BehaviorSubject, Observable } from 'rxjs';

export const isDarkMode$ = new BehaviorSubject<boolean>(false);

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

export const useIsDarkMode = (): boolean => useObservableState(isDarkMode$);
