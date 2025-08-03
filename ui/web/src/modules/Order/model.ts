import { IOrder } from '@yuants/data-order';
import { BehaviorSubject } from 'rxjs';

export const orders$ = new BehaviorSubject<IOrder[]>([]);
