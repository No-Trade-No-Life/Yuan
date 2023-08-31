import { Kernel } from '@yuants/kernel';
import { BehaviorSubject } from 'rxjs';

export const currentKernel$ = new BehaviorSubject<Kernel | null>(null);
currentKernel$.subscribe((kernel) => {
  Object.assign(globalThis, { kernel });
});
