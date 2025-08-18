import { BehaviorSubject } from 'rxjs';

export const recordTable$ = new BehaviorSubject<Record<string, Record<string, string | number>[]>>({});
