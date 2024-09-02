import { formatTime } from '@yuants/data-model';
import { BehaviorSubject } from 'rxjs';

export const log = (...params: any[]) => {
  console.info(formatTime(Date.now()), 'BIOS', ...params);
  fullLog$.next(fullLog$.value + `${formatTime(Date.now())} ${params.join(' ')}\n`);
};

export const fullLog$ = new BehaviorSubject('');
