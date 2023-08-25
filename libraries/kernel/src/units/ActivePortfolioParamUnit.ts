import { Kernel } from '../kernel';
import { AccountPerformanceUnit } from './AccountPerformanceUnit';
import { BasicUnit } from './BasicUnit';

/**
 * @internal
 */
export const covariance = (a: number[], b: number[]) => {
  const aMean = a.reduce((p, c) => p + c, 0) / a.length;
  const bMean = b.reduce((p, c) => p + c, 0) / b.length;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - aMean) * (b[i] - bMean);
  }
  return sum / (a.length - 1);
};

/**
 * @internal
 */
export const variance = (a: number[]) => {
  const aMean = a.reduce((p, c) => p + c, 0) / a.length;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - aMean) ** 2;
  }
  return sum / (a.length - 1);
};

/**
 * @internal
 */
export const covariance_matrix = (a: number[][]): number[][] => {
  return a.map((_, i) => a.map((_, j) => covariance(a[i], a[j])));
};

export class ActivePortfolioParamUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public accountPerformanceUnit: AccountPerformanceUnit,
    public benchmarkPerformanceUnit: AccountPerformanceUnit,
  ) {
    super(kernel);
  }

  private totalDays = 0;
  private totalWeeks = 0;

  public active_portfolio_parameters = {
    daily_beta: NaN,
    daily_alpha: NaN,
    daily_omega: NaN,
    daily_IR: NaN,
    daily_IC: NaN,

    daily_return_ratio_list: [] as number[],

    weekly_beta: NaN,
    weekly_alpha: NaN,
    weekly_omega: NaN,
    weekly_IR: NaN,
    weekly_IC: NaN,

    weekly_return_ratio_list: [] as number[],
  };

  onEvent() {
    if (this.accountPerformanceUnit.performance.total_days !== this.totalDays) {
      this.totalDays = this.accountPerformanceUnit.performance.total_days;

      const r_P_variance = variance(this.accountPerformanceUnit.performance._daily_return_ratio_list);
      const r_B_variance = variance(this.benchmarkPerformanceUnit.performance._daily_return_ratio_list);

      this.active_portfolio_parameters.daily_beta =
        covariance(
          this.accountPerformanceUnit.performance._daily_return_ratio_list,
          this.benchmarkPerformanceUnit.performance._daily_return_ratio_list,
        ) / r_B_variance;

      this.active_portfolio_parameters.daily_alpha =
        this.accountPerformanceUnit.performance._daily_return_ratio_list
          .map(
            (r_n: number, i: number) =>
              r_n -
              this.active_portfolio_parameters.daily_beta *
                this.benchmarkPerformanceUnit.performance._daily_return_ratio_list[i],
          )
          .reduce((acc, cur) => acc + cur, 0) / this.totalDays;
      this.active_portfolio_parameters.daily_omega = Math.sqrt(
        r_P_variance - this.active_portfolio_parameters.daily_beta ** 2 * r_B_variance,
      );

      this.active_portfolio_parameters.daily_IR =
        this.active_portfolio_parameters.daily_alpha / this.active_portfolio_parameters.daily_omega;
      this.active_portfolio_parameters.daily_IC =
        this.active_portfolio_parameters.daily_IR /
        Math.sqrt(this.accountPerformanceUnit.performance.total_days);

      this.active_portfolio_parameters.daily_return_ratio_list =
        this.accountPerformanceUnit.performance._daily_return_ratio_list;
    }
    if (this.accountPerformanceUnit.performance.total_weeks !== this.totalWeeks) {
      this.totalWeeks = this.accountPerformanceUnit.performance.total_weeks;

      const r_P_variance = variance(this.accountPerformanceUnit.performance._weekly_return_ratio_list);
      const r_B_variance = variance(this.benchmarkPerformanceUnit.performance._weekly_return_ratio_list);

      this.active_portfolio_parameters.weekly_beta =
        covariance(
          this.accountPerformanceUnit.performance._weekly_return_ratio_list,
          this.benchmarkPerformanceUnit.performance._weekly_return_ratio_list,
        ) / r_B_variance;

      this.active_portfolio_parameters.weekly_alpha =
        this.accountPerformanceUnit.performance._weekly_return_ratio_list
          .map(
            (r_n: number, i: number) =>
              r_n -
              this.active_portfolio_parameters.weekly_beta *
                this.benchmarkPerformanceUnit.performance._weekly_return_ratio_list[i],
          )
          .reduce((acc, cur) => acc + cur, 0) / this.totalWeeks;

      this.active_portfolio_parameters.weekly_omega = Math.sqrt(
        r_P_variance - this.active_portfolio_parameters.weekly_beta ** 2 * r_B_variance,
      );

      this.active_portfolio_parameters.weekly_IR =
        this.active_portfolio_parameters.weekly_alpha / this.active_portfolio_parameters.weekly_omega;
      this.active_portfolio_parameters.weekly_IC =
        this.active_portfolio_parameters.weekly_IR /
        Math.sqrt(this.accountPerformanceUnit.performance.total_weeks);

      this.active_portfolio_parameters.weekly_return_ratio_list =
        this.accountPerformanceUnit.performance._weekly_return_ratio_list;
    }
  }
}
