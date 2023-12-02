import { defer, map, mergeMap, shareReplay } from 'rxjs';

export const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const inferLocaleFromTimezone = (timezone: string) => {
  switch (timezone) {
    case 'Asia/Shanghai':
      return 'zh';
    default:
      return 'en';
  }
};

export const userLocale = inferLocaleFromTimezone(userTimezone);

export const region$ = defer(() => fetch('https://api.country.is')).pipe(
  //
  mergeMap((res) => res.json()),
  map((res: { ip: string; country: string }) => res.country),
  shareReplay(1),
);
