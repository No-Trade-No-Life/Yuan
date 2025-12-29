import { IAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { formatTime, roundToStep, UUID } from '@yuants/utils';
import { Kernel } from '../kernel';
import { diffPosition, mergePositions } from '../utils';
import { AccountPerformanceUnit, IAccountPerformance } from './AccountPerformanceUnit';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { OrderMatchingUnit } from './OrderMatchingUnit';
import { PeriodDataUnit } from './PeriodDataUnit';

/**
 * @public
 */
export interface IPortfolioStatistics {
  start_timestamp: number;
  coefficients: Record<string, number>;
  period_start_target_account_info: IAccountInfo;
  period_end_target_account_info: IAccountInfo;
  period_source_account_statistics: Record<
    string,
    {
      start_account_info: IAccountInfo;
      end_account_info: IAccountInfo;
      performance: IAccountPerformance;
    }
  >;
  target_account_performance: IAccountPerformance;
}

/**
 * 投资组合模拟器单元
 * @public
 */
export class PortfolioSimulatorUnit extends BasicUnit {
  private coefficient_fn: (ctx: {
    stopLossAccountPerformance: IAccountPerformance;
    originAccountPerformance: IAccountPerformance;
    targetAccountInfo: IAccountInfo;
  }) => number;
  constructor(
    public kernel: Kernel,
    public coefficient_fn_str: string,
    public periodDataUnit: PeriodDataUnit,
    public mapAccountInfoToUnits: Record<
      string,
      {
        accountInfoUnit: AccountSimulatorUnit;
        accountPerformanceUnit: AccountPerformanceUnit;
        originAccountInfoUnit: AccountSimulatorUnit;
        originAccountPerformanceUnit: AccountPerformanceUnit;
        historyOrderUnit: HistoryOrderUnit;
      }
    >,
    public targetAccountInfoUnit: AccountSimulatorUnit,
    public targetAccountPerformanceUnit: AccountPerformanceUnit,
    public targetOrderMatchingUnit: OrderMatchingUnit,
  ) {
    super(kernel);
    for (const accountId of Object.keys(mapAccountInfoToUnits)) {
      this.mapAccountIdToCoefficient[accountId] = 0;
    }

    this.coefficient_fn = new Function('ctx', `return (${coefficient_fn_str})(ctx)`) as any;
  }

  private current_next_sunday: number = 0;
  private weeks_passed: number = 0;

  private mapAccountIdToCoefficient: Record<string, number> = {};

  private current_week_start_timestamp = 0;
  private current_week_start_target_account_info: IAccountInfo | undefined = undefined;
  private current_week_end_target_account_info: IAccountInfo | undefined = undefined;
  private mapAccountIdToWeekStartSourceAccountInfo: Record<string, IAccountInfo> = {};
  private mapAccountIdToWeekEndSourceAccountInfo: Record<string, IAccountInfo> = {};
  private mapAccountIdToWeekEndSourceAccountPerformance: Record<string, IAccountPerformance> = {};
  private current_week_target_account_performance: IAccountPerformance | undefined = undefined;

  statistics: IPortfolioStatistics[] = [];

  private getNextUTCSunday = (timestamp: number): number => {
    const date = new Date(timestamp);
    date.setDate(date.getDate() - date.getDay() + 7);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  onEvent(): void {
    const nextSunday = this.getNextUTCSunday(this.kernel.currentTimestamp);
    // 初始化状态
    if (nextSunday !== this.current_next_sunday) {
      this.current_next_sunday = nextSunday;
      this.weeks_passed++;

      // 了结上周状态
      this.current_week_end_target_account_info = this.targetAccountInfoUnit.accountInfo;
      this.current_week_target_account_performance = this.targetAccountPerformanceUnit.performance;
      for (const { accountInfoUnit, accountPerformanceUnit } of Object.values(this.mapAccountInfoToUnits)) {
        const { performance } = accountPerformanceUnit;
        this.mapAccountIdToWeekEndSourceAccountInfo[accountInfoUnit.accountInfo.account_id] =
          accountInfoUnit.accountInfo;
        this.mapAccountIdToWeekEndSourceAccountPerformance[accountInfoUnit.accountInfo.account_id] =
          performance;
      }

      this.statistics.push({
        start_timestamp: this.current_week_start_timestamp,
        coefficients: { ...this.mapAccountIdToCoefficient },
        period_start_target_account_info: this.current_week_start_target_account_info!,
        period_end_target_account_info: this.current_week_end_target_account_info!,
        period_source_account_statistics: Object.fromEntries(
          Object.entries(this.mapAccountIdToWeekStartSourceAccountInfo).map(([accountId, accountInfo]) => [
            accountId,
            {
              start_account_info: accountInfo,
              end_account_info: this.mapAccountIdToWeekEndSourceAccountInfo[accountId],
              performance: this.mapAccountIdToWeekEndSourceAccountPerformance[accountId],
            },
          ]),
        ),
        target_account_performance: this.current_week_target_account_performance!,
      });

      // 新的一周新的初始状态
      for (const { accountInfoUnit, accountPerformanceUnit, originAccountPerformanceUnit } of Object.values(
        this.mapAccountInfoToUnits,
      )) {
        const ctx = {
          stopLossAccountPerformance: accountPerformanceUnit.performance,
          originAccountPerformance: originAccountPerformanceUnit.performance,
          targetAccountInfo: this.targetAccountInfoUnit.accountInfo,
        };
        // 决定跟单系数
        try {
          const coefficient = this.coefficient_fn(ctx);
          this.mapAccountIdToCoefficient[accountInfoUnit.accountInfo.account_id] = coefficient;
        } catch (e) {
          console.error(formatTime(Date.now()), 'Coefficient function calculate error: ', e, 'ctx: ', ctx);
          this.mapAccountIdToCoefficient[accountInfoUnit.accountInfo.account_id] = 0;
        }
        this.current_week_start_timestamp = this.kernel.currentTimestamp;
        this.current_week_start_target_account_info = this.targetAccountInfoUnit.accountInfo;
        this.mapAccountIdToWeekStartSourceAccountInfo[accountInfoUnit.accountInfo.account_id] =
          accountInfoUnit.accountInfo;
      }
    }

    this.sendOrders();
  }

  private sendOrders() {
    // 跟单阵列计算
    const ordersToSend: IOrder[] = [];
    const sourcePositions = mergePositions(
      Object.values(this.mapAccountInfoToUnits).flatMap(({ accountInfoUnit }) =>
        accountInfoUnit.accountInfo.positions.map((position) => {
          const volume =
            position.volume * this.mapAccountIdToCoefficient[accountInfoUnit.accountInfo.account_id];
          return {
            ...position,
            volume,
            free_volume: volume,
          };
        }),
      ),
    ).filter((position) => position.volume > 0);
    const targetPositions = this.targetAccountInfoUnit.accountInfo.positions;
    const positionDiffs = diffPosition(sourcePositions, targetPositions);
    // 根据仓位差异下单
    for (const positionDiff of positionDiffs) {
      const account_id = this.targetAccountInfoUnit.accountInfo.account_id;
      const product_id = positionDiff.product_id;
      // 逻辑有问题
      const order: IOrder = {
        order_id: UUID(),
        account_id: account_id,
        product_id: product_id,
        position_id:
          positionDiff.direction === 'LONG'
            ? `${positionDiff.product_id}-LONG`
            : `${positionDiff.product_id}-SHORT`,
        order_type: 'MARKET',
        order_direction:
          positionDiff.direction === 'LONG'
            ? positionDiff.error_volume > 0
              ? 'OPEN_LONG'
              : 'CLOSE_LONG'
            : positionDiff.error_volume > 0
            ? 'OPEN_SHORT'
            : 'CLOSE_SHORT',
        volume: roundToStep(Math.abs(positionDiff.error_volume), 1),
      };
      if (order.volume > 0) {
        ordersToSend.push(order);
      }
    }

    if (ordersToSend.length > 0) {
      this.targetOrderMatchingUnit.submitOrder(...ordersToSend);
    }
  }
}
