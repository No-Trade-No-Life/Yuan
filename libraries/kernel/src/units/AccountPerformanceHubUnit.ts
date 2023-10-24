import { Kernel } from '../kernel';
import { AccountInfoUnit } from './AccountInfoUnit';
import { AccountPerformanceUnit, IAccountPerformance } from './AccountPerformanceUnit';
import { BasicUnit } from './BasicUnit';

/**
 * @public
 */
export class AccountPerformanceHubUnit extends BasicUnit {
  constructor(public kernel: Kernel, public accountInfoUnit: AccountInfoUnit) {
    super(kernel);
  }

  mapAccountIdToPerformance: Map<string, IAccountPerformance> = new Map();

  onEvent(): void | Promise<void> {
    for (const [accountId, accountInfo] of this.accountInfoUnit.mapAccountIdToAccountInfo.entries()) {
      const lastPerformance =
        this.mapAccountIdToPerformance.get(accountId) ||
        AccountPerformanceUnit.makeInitAccountPerformance(accountId);
      const performance = AccountPerformanceUnit.reduceAccountPerformance(lastPerformance, accountInfo);
      this.mapAccountIdToPerformance.set(accountId, performance);
    }
  }
}
