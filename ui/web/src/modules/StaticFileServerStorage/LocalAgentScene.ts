import { AgentUnit, IAgentConf } from '@yuants/agent';
import { UUID } from '@yuants/data-model';
import {
  AccountInfoUnit,
  AccountPerformanceHubUnit,
  BasicUnit,
  DataLoadingTaskUnit,
  HistoryOrderUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  QuoteDataUnit,
  SeriesDataUnit,
} from '@yuants/kernel';
import { StaticFileServerPeriodLoadingUnit } from './StaticFileServerPeriodLoadingUnit';

/**
 * For back-test only
 *
 * @public
 */
export const LocalAgentScene = async (agentConf: IAgentConf) => {
  const agentCode = agentConf.bundled_code;
  if (!agentCode) throw new Error('agentConf.bundled_code is required');
  const resolved_account_id = agentConf.account_id || UUID();
  const resolved_currency = agentConf.currency || 'YYY';

  const resolved_start_timestamp = agentConf.start_time ? Date.parse(agentConf.start_time) : 0;
  const resolved_end_timestamp = agentConf.end_time ? Date.parse(agentConf.end_time) : Date.now();

  const kernel = new Kernel();
  if (agentConf.disable_log) {
    kernel.log = undefined;
  }
  const productDataUnit = new ProductDataUnit(kernel);
  const quoteDataUnit = new QuoteDataUnit(kernel);
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const seriesDataUnit = new SeriesDataUnit(kernel);
  const dataLoadingTaskUnit = new DataLoadingTaskUnit(kernel);
  new BasicUnit(kernel).onInit = () => {
    for (const periodTask of dataLoadingTaskUnit.periodTasks) {
      periodLoadingUnit.periodTasks.push({ ...periodTask });
    }
  };
  const periodLoadingUnit = new StaticFileServerPeriodLoadingUnit(kernel, productDataUnit, periodDataUnit);
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const orderMatchingUnit = new OrderMatchingUnit(
    kernel,
    productDataUnit,
    periodDataUnit,
    historyOrderUnit,
    quoteDataUnit,
  );
  const accountInfoUnit = new AccountInfoUnit(kernel, productDataUnit, quoteDataUnit, historyOrderUnit);
  accountInfoUnit.useAccount(
    resolved_account_id,
    resolved_currency,
    agentConf.leverage,
    agentConf.initial_balance,
  );
  const accountPerformanceUnit = new AccountPerformanceHubUnit(kernel, accountInfoUnit);

  const agentUnit = new AgentUnit(kernel, agentCode, agentConf.agent_params || {}, {
    start_time: resolved_start_timestamp,
    end_time: resolved_end_timestamp,
    account_id: resolved_account_id,
    currency: resolved_currency,
    leverage: agentConf.leverage,
    initial_balance: agentConf.initial_balance,
  });

  await agentUnit.execute();

  return {
    kernel,
    agentUnit,
    periodDataUnit,
    quoteDataUnit,
    productDataUnit,

    accountInfoUnit,
    accountPerformanceUnit,
    historyOrderUnit,
  };
};
