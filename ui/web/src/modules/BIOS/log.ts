import { formatTime } from '@yuants/data-model';
import { BehaviorSubject } from 'rxjs';

export const log = (...params: any[]) => {
  console.info(formatTime(Date.now()), 'BIOS', ...params);
  const line = `${params.join(' ')}`;
  logLines.push(line);
  fullLog$.next(fullLog$.value + `${formatTime(Date.now())} ${line}\n`);
};

export const logLines: string[] = [];
export const fullLog$ = new BehaviorSubject('');
