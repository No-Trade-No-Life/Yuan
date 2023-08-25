import { Kernel } from '../kernel';
import { AccountPerformanceUnit } from './AccountPerformanceUnit';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { BasicUnit } from './BasicUnit';

/**
 * @public
 */
export interface IAccountFrame {
  timestamp_in_us: number;
  equity: number;
  balance: number;
  profit: number;
  margin: number;
  require: number;
}

/**
 * 账户帧单元
 */
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
    // 保证每个帧的时间戳不重复
    if (idx >= 0 && this.data[idx].timestamp_in_us === metric.timestamp_in_us) {
      this.data[idx] = metric;
    } else {
      this.data.push(metric);
    }
  }
}
