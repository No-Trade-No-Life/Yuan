import { IAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { roundToStep, UUID } from '@yuants/utils';
import { Kernel } from '../kernel';
import { diffPosition, mergePositions } from '../utils';
import { AccountPerformanceUnit, IAccountPerformance } from './AccountPerformanceUnit';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { ActivePortfolioParamUnit, covariance_matrix } from './ActivePortfolioParamUnit';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { OrderMatchingUnit } from './OrderMatchingUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { IPortfolioStatistics } from './PortfolioSimulatorUnit';
//@ts-ignore
import qp from 'quadprog';

/**
 * @public
 */
export const optimizeHoldingParameters = (
  base: number[],
  alpha: number[],
  V: number[][],
  lambda: number,
): {
  holdings_in_active: number[];
  holdings_of_portfolio: number[];
  value: number;
} => {
  const padding_matrix = (matrix: number[][]) => {
    return Array.from({ length: matrix.length + 1 }, (_, i) =>
      Array.from({ length: matrix[0].length + 1 }, (_, j) => {
        if (i === 0 || j === 0) return 0;
        return matrix[i - 1][j - 1];
      }),
    );
  };

  const padding_vector = (vector: number[]) => {
    return [0, ...vector];
  };

  const Dmat = V.map((row) => row.map((v) => v * 2 * lambda));
  const dvec = alpha.map((v) => v);

  // 约束
  const n = base.length;
  const Amat = Array.from({ length: 2 * n + 2 }, () => Array.from({ length: n }, () => 0));
  const bvec = Array.from({ length: 2 * n + 2 }, () => 0);
  for (let i = 0; i < n; i++) {
    Amat[i][i] = 1;
    bvec[i] = -1 / n;
    Amat[i + n][i] = -1;
    bvec[i + n] = -2 / n;
  }
  for (let i = 0; i < n; i++) {
    Amat[2 * n][i] = 1;
    bvec[2 * n] = 0;
    Amat[2 * n + 1][i] = -1;
    bvec[2 * n + 1] = 0;
  }

  const AmatT = Array.from({ length: n }, (_, i) => Array.from({ length: 2 * n + 2 }, (_, j) => Amat[j][i]));

  /*
  A
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, -1]
  [1, 1, 1],
  [-1, -1, -1],

  b
  [1, 1, 1, 0, 0, 0, 0, 0],

  Ax <= b
  */

  const result = qp.solveQP(
    padding_matrix(Dmat),
    padding_vector(dvec),
    padding_matrix(AmatT),
    padding_vector(bvec),
  );

  const fixed_solution = result.solution.slice(1) as number[];

  return {
    holdings_in_active: fixed_solution,
    holdings_of_portfolio: fixed_solution.map((v, i) => v + base[i]),
    value: result.value,
  };
};

/**
 * 主动投资组合优化模拟器单元
 * @Public
 */
export class ActivePortfolioOptimizeSimulatorUnit extends BasicUnit {
  // TODO: 和 PortfolioSimulatorUnit 合并
  constructor(
    public kernel: Kernel,
    public periodDataUnit: PeriodDataUnit,
    public lambda: number,
    public mapAccountIdToUnits: Record<
      string,
      {
        accountInfoUnit: AccountSimulatorUnit;
        accountPerformanceUnit: AccountPerformanceUnit;
        activePortfolioParamUnit: ActivePortfolioParamUnit;
        historyOrderUnit: HistoryOrderUnit;
      }
    >,
    public targetAccountInfoUnit: AccountSimulatorUnit,
    public targetAccountPerformanceUnit: AccountPerformanceUnit,
    public targetOrderMatchingUnit: OrderMatchingUnit,
  ) {
    super(kernel);
    for (const accountId of Object.keys(mapAccountIdToUnits)) {
      this.mapAccountIdToCoefficient[accountId] = 0;
    }
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

  onEvent(): void | Promise<void> {
    const nextSunday = this.getNextUTCSunday(this.kernel.currentTimestamp);

    if (nextSunday !== this.current_next_sunday) {
      this.current_next_sunday = nextSunday;
      this.weeks_passed++;

      // 了结上周状态
      this.current_week_end_target_account_info = this.targetAccountInfoUnit.accountInfo;
      this.current_week_target_account_performance = this.targetAccountPerformanceUnit.performance;
      for (const { accountInfoUnit, accountPerformanceUnit } of Object.values(this.mapAccountIdToUnits)) {
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

      // 决定本周系数
      const n = Object.keys(this.mapAccountIdToUnits).length;
      const alpha_list = Object.values(this.mapAccountIdToUnits).map(
        ({ activePortfolioParamUnit }) => activePortfolioParamUnit.active_portfolio_parameters.daily_alpha,
      );
      const base = Array.from({ length: n }, () => 1 / n);
      const V = covariance_matrix(
        Object.values(this.mapAccountIdToUnits).map(
          ({ activePortfolioParamUnit }) =>
            activePortfolioParamUnit.active_portfolio_parameters.daily_return_ratio_list,
        ),
      );
      const result = optimizeHoldingParameters(base, alpha_list, V, this.lambda);

      this.mapAccountIdToCoefficient = Object.fromEntries(
        Object.entries(this.mapAccountIdToUnits).map(([accountId], i) => [
          accountId,
          result.holdings_of_portfolio[i],
        ]),
      );
      this.current_week_start_timestamp = this.kernel.currentTimestamp;
      this.current_week_start_target_account_info = this.targetAccountInfoUnit.accountInfo;
    }

    this.sendOrders();
  }

  private sendOrders() {
    // 跟单阵列计算
    const ordersToSend: IOrder[] = [];
    const sourcePositions = mergePositions(
      Object.values(this.mapAccountIdToUnits).flatMap(({ accountInfoUnit }) =>
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
