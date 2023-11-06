import { useObservableState } from 'observable-hooks';
import { BehaviorSubject } from 'rxjs';

const mapIdToValue: Record<string, BehaviorSubject<any>> = {};

export const useValue = <T>(id: string, initialValue: T): [T, (v: T) => void] => {
  const sub = (mapIdToValue[id] ??= new BehaviorSubject(initialValue));
  const value = useObservableState(sub);
  return [
    value,
    (v) => {
      sub.next(v);
    },
  ];
};
