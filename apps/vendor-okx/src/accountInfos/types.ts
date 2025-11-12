import { IAccountMoney, IPosition } from '@yuants/data-account';

export interface IAccountInfoCore {
  money: Pick<IAccountMoney, 'currency' | 'equity' | 'free'>;
  positions: IPosition[];
}
