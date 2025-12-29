import { Terminal } from '@yuants/protocol';
import { Kernel } from '../kernel';
import {
  AccountInfoUnit,
  AccountPerformanceHubUnit,
  HistoryOrderUnit,
  HistoryPeriodLoadingUnit,
  OrderLoadingUnit,
  PeriodDataUnit,
  QuoteDataUnit,
  TerminateUnit,
} from '../units';

/**
 * 内建场景: 账户回放
 *
 * @public
 */
export const AccountReplayScene = (
  terminal: Terminal,
  account_id: string,
  currency: string,
  leverage: number,
  start_timestamp: number,
  end_timestamp: number,
  duration: string,
  datasource_id?: string,
) => {
  const kernel = new Kernel();

  const quoteDataUnit = new QuoteDataUnit(kernel);
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit);
  const orderLoadingUnit = new OrderLoadingUnit(kernel, terminal, historyOrderUnit);
  orderLoadingUnit.tasks.push({
    account_id,
    start_time: start_timestamp,
    end_time: end_timestamp,
  });

  // Adhoc Unit: 根据品种加载行情数据
  // new BasicUnit(kernel).onInit = () => {
  //   for (const product of productDataUnit.listProducts()) {
  //     periodLoadingUnit.periodTasks.push({
  //       series_id: encodePath(product.datasource_id, product.product_id, duration),
  //       start_time: start_timestamp,
  //       end_time: end_timestamp,
  //     });
  //   }
  // };

  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, periodDataUnit);
  const accountInfoUnit = new AccountInfoUnit(kernel, quoteDataUnit, historyOrderUnit);
  accountInfoUnit.useAccount(account_id, currency, leverage);

  const accountPerformanceUnit = new AccountPerformanceHubUnit(kernel, accountInfoUnit);
  new TerminateUnit(kernel);
  return { kernel, accountInfoUnit, accountPerformanceUnit };
};
