import { IOrder } from '@yuants/data-model';
import { BehaviorSubject } from 'rxjs';

export const orders$ = new BehaviorSubject<IOrder[]>([]);
