import { IOrder } from '@yuants/protocol';
import { BehaviorSubject } from 'rxjs';

export const orders$ = new BehaviorSubject<IOrder[]>([]);
