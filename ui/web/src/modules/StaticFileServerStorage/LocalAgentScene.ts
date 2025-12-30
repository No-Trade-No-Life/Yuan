import { AgentUnit, IAgentConf } from '@yuants/agent';
import {
  AccountDatasourceRelationUnit,
  AccountInfoUnit,
  AccountPerformanceHubUnit,
  DataLoadingTaskUnit,
  HistoryOrderUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  QuoteDataUnit,
  SeriesDataUnit,
  TerminateUnit,
  TickDataUnit,
} from '@yuants/kernel';

/**
 * For back-test only
 *
 * @public
 */
export const LocalAgentScene = async (agentConf: IAgentConf) => {
  const agentCode = agentConf.bundled_code;
  if (!agentCode) throw new Error('agentConf.bundled_code is required');

  const resolved_start_timestamp = agentConf.start_time ? Date.parse(agentConf.start_time) : 0;
  const resolved_end_timestamp = agentConf.end_time ? Date.parse(agentConf.end_time) : Date.now();

  const kernel = new Kernel(agentConf.kernel_id);
  if (agentConf.disable_log) {
    kernel.log = undefined;
  }
  const quoteDataUnit = new QuoteDataUnit(kernel);
  new AccountDatasourceRelationUnit(kernel);
  const tickDataUnit = new TickDataUnit(kernel);
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const seriesDataUnit = new SeriesDataUnit(kernel);
  const dataLoadingTaskUnit = new DataLoadingTaskUnit(kernel);
  // new BasicUnit(kernel).onInit = () => {
  //   for (const periodTask of dataLoadingTaskUnit.periodTasks) {
  //     // FIXME: `period_in_sec` property is deprecated
  //     periodLoadingUnit.periodTasks.push({ ...periodTask, period_in_sec: 0 });
  //   }
  // };
  // const periodLoadingUnit = new StaticFileServerPeriodLoadingUnit(kernel, productDataUnit, periodDataUnit);
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit);
  const accountInfoUnit = new AccountInfoUnit(kernel, quoteDataUnit, historyOrderUnit);
  const orderMatchingUnit = new OrderMatchingUnit(
    kernel,
    periodDataUnit,
    tickDataUnit,
    accountInfoUnit,
    historyOrderUnit,
    quoteDataUnit,
  );
  const accountPerformanceUnit = new AccountPerformanceHubUnit(kernel, accountInfoUnit);

  const agentUnit = new AgentUnit(kernel, agentCode, agentConf.agent_params || {}, {
    start_time: resolved_start_timestamp,
    end_time: resolved_end_timestamp,
  });

  await agentUnit.execute();

  if (!agentConf.is_real) {
    new TerminateUnit(kernel);
  }

  return {
    kernel,
    agentUnit,
    periodDataUnit,
    quoteDataUnit,
    accountInfoUnit,
    accountPerformanceUnit,
    historyOrderUnit,
  };
};
