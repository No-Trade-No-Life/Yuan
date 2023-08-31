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

export const PERIOD_IN_SEC_TO_LABEL: Record<number, string> = {
  60: '1分钟',
  300: '5分钟',
  900: '15分钟',
  1800: '30分钟',
  3600: '1小时',
  14400: '4小时',
  86400: '1天',
  [7 * 86400]: '1周',
  [30 * 86400]: '1月',
};
