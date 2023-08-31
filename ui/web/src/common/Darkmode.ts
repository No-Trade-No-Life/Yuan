import { BehaviorSubject } from 'rxjs';

export const isDarkMode$ = new BehaviorSubject<boolean>(false);

const mql = window.matchMedia('(prefers-color-scheme: dark)');
function matchMode(e: any) {
  const body = document.body;
  if (e.matches) {
    isDarkMode$.next(true);
    if (!body.hasAttribute('theme-mode')) {
      body.setAttribute('theme-mode', 'dark');
    }
  } else {
    isDarkMode$.next(false);
    if (body.hasAttribute('theme-mode')) {
      body.removeAttribute('theme-mode');
    }
  }
}

mql.addListener(matchMode);
matchMode(mql);
