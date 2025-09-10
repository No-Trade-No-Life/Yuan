import { AccountInfoUnit, AccountPerformanceHubUnit, BasicUnit, Kernel } from '@yuants/kernel';
import { IAccountFrame } from './model';

export class AccountFrameUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public accountInfoUnit: AccountInfoUnit,
    public accountPerformanceUnit: AccountPerformanceHubUnit,
  ) {
    super(kernel);
  }

  data: Record<string, IAccountFrame[]> = {};
  onEvent(): void | Promise<void> {
    for (const [accountId, accountInfo] of this.accountInfoUnit.mapAccountIdToAccountInfo.entries()) {
      const metric = {
        timestamp: accountInfo.updated_at!,
        balance: accountInfo.money.balance,
        equity: accountInfo.money.equity,
        margin: accountInfo.money.used,
        profit: accountInfo.money.profit,
        require: this.accountPerformanceUnit.mapAccountIdToPerformance.get(accountId)!.maintenance_margin,
      };
      this.data[accountId] ??= [];
      const idx = this.data[accountId].length - 1;
      // ensure unique timestamp
      if (idx >= 0 && this.data[accountId][idx].timestamp === metric.timestamp) {
        this.data[accountId][idx] = metric;
      } else {
        this.data[accountId].push(metric);
      }
    }
  }
}
