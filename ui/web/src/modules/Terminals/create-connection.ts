import { useObservableState } from 'observable-hooks';
import { terminal$ } from '../Network';
export { hostUrl$, terminal$ } from '../Network';

export const useTerminal = () => useObservableState(terminal$);
