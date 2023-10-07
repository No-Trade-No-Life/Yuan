import { AccountPerformanceUnit, AccountSimulatorUnit, BasicUnit, Kernel } from '@yuants/kernel';
import { IAccountFrame } from './model';

export class AccountFrameUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public accountInfoUnit: AccountSimulatorUnit,
    public accountPerformanceUnit: AccountPerformanceUnit,
  ) {
    super(kernel);
  }

  data: IAccountFrame[] = [];
  onEvent(): void | Promise<void> {
    const metric = {
      timestamp_in_us: this.accountInfoUnit.accountInfo.timestamp_in_us,
      balance: this.accountInfoUnit.accountInfo.money.balance,
      equity: this.accountInfoUnit.accountInfo.money.equity,
      margin: this.accountInfoUnit.accountInfo.money.used,
      profit: this.accountInfoUnit.accountInfo.money.profit,
      require: this.accountPerformanceUnit.performance.maintenance_margin,
    };
    const idx = this.data.length - 1;
    // ensure unique timestamp
    if (idx >= 0 && this.data[idx].timestamp_in_us === metric.timestamp_in_us) {
      this.data[idx] = metric;
    } else {
      this.data.push(metric);
    }
  }
}
