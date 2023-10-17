import { AgentUnit, IAgentConf } from '@yuants/agent';
import { UUID } from '@yuants/data-model';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  CounterpartyOrderMappingUnit,
  DataLoadingTaskUnit,
  HistoryOrderUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  PortfolioSimulatorUnit,
  PositionLimitOrderMappingUnit,
  ProductDataUnit,
  QuoteDataUnit,
  SeriesDataUnit,
  StopLossOrderMapperUnit,
  createEmptyAccountInfo,
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
  const originHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const originOrderMatchingUnit = new OrderMatchingUnit(
    kernel,
    productDataUnit,
    periodDataUnit,
    originHistoryOrderUnit,
  );
  const originAccountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    originHistoryOrderUnit,
    createEmptyAccountInfo(
      resolved_account_id,
      resolved_currency,
      agentConf.leverage,
      agentConf.initial_balance,
    ),
  );
  const originAccountPerformanceUnit = new AccountPerformanceUnit(kernel, originAccountInfoUnit);

  const agentUnit = new AgentUnit(kernel, agentCode, agentConf.agent_params || {}, {
    start_time: resolved_start_timestamp,
    end_time: resolved_end_timestamp,
  });

  let positionLimitAccountInfoUnit: AccountSimulatorUnit | undefined;
  let positionLimitAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let positionLimitOrderMatchingUnit: OrderMatchingUnit | undefined;
  let positionLimitHistoryOrderUnit: HistoryOrderUnit | undefined;

  if (agentConf.position_limit) {
    positionLimitHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
    positionLimitOrderMatchingUnit = new OrderMatchingUnit(
      kernel,
      productDataUnit,
      periodDataUnit,
      positionLimitHistoryOrderUnit,
    );
    positionLimitAccountInfoUnit = new AccountSimulatorUnit(
      kernel,
      productDataUnit,
      quoteDataUnit,
      positionLimitHistoryOrderUnit,
      createEmptyAccountInfo(
        `${resolved_account_id}-PL`,
        resolved_currency,
        agentConf.leverage,
        agentConf.initial_balance,
      ),
    );
    const positionLimitUnit = new PositionLimitOrderMappingUnit(
      kernel,
      agentConf.position_limit,
      originOrderMatchingUnit,
      positionLimitOrderMatchingUnit,
      positionLimitAccountInfoUnit,
    );
    positionLimitAccountPerformanceUnit = new AccountPerformanceUnit(kernel, positionLimitAccountInfoUnit);
  }

  let counterpartyAccountInfoUnit: AccountSimulatorUnit | undefined;
  let counterpartyAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let counterpartyHistoryOrderUnit: HistoryOrderUnit | undefined;

  if (agentConf.as_counterparty) {
    counterpartyHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
    const counterpartyOrderMatchingUnit = new OrderMatchingUnit(
      kernel,
      productDataUnit,
      periodDataUnit,
      counterpartyHistoryOrderUnit,
    );
    const counterpartyUnit = new CounterpartyOrderMappingUnit(
      kernel,
      positionLimitOrderMatchingUnit || originOrderMatchingUnit,
      counterpartyOrderMatchingUnit,
    );
    const counterpartyAccountInfo = createEmptyAccountInfo(
      `${resolved_account_id}-CP`,
      resolved_currency,
      agentConf.leverage,
      agentConf.initial_balance,
    );
    counterpartyAccountInfoUnit = new AccountSimulatorUnit(
      kernel,
      productDataUnit,
      quoteDataUnit,
      counterpartyHistoryOrderUnit,
      counterpartyAccountInfo,
    );
    counterpartyAccountPerformanceUnit = new AccountPerformanceUnit(kernel, counterpartyAccountInfoUnit);
  }

  let stopLossAccountInfoUnit: AccountSimulatorUnit | undefined;
  let stopLossAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let stopLossHistoryOrderUnit: HistoryOrderUnit | undefined;

  let portfolioAccountInfoUnit: AccountSimulatorUnit | undefined;
  let portfolioAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let portfolioHistoryOrderUnit: HistoryOrderUnit | undefined;

  if (agentConf.resume_on_source_margin_below && agentConf.stop_loss_drawdown_quota) {
    const stopLossInitAccountInfo = createEmptyAccountInfo(
      `${resolved_account_id}-SL`,
      resolved_currency,
      agentConf.leverage,
      agentConf.initial_balance,
    );
    stopLossHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
    const stopLossOrderMatchingUnit = new OrderMatchingUnit(
      kernel,
      productDataUnit,
      periodDataUnit,
      stopLossHistoryOrderUnit,
    );

    stopLossAccountInfoUnit = new AccountSimulatorUnit(
      kernel,
      productDataUnit,
      quoteDataUnit,
      stopLossHistoryOrderUnit,
      stopLossInitAccountInfo,
    );
    stopLossAccountPerformanceUnit = new AccountPerformanceUnit(kernel, stopLossAccountInfoUnit);

    new StopLossOrderMapperUnit(
      kernel,
      stopLossInitAccountInfo.account_id,
      agentConf.resume_on_source_margin_below,
      agentConf.stop_loss_drawdown_quota,
      productDataUnit,
      quoteDataUnit,
      positionLimitAccountInfoUnit || originAccountInfoUnit,
      positionLimitAccountPerformanceUnit || originAccountPerformanceUnit,
      positionLimitHistoryOrderUnit || originHistoryOrderUnit,
      stopLossAccountInfoUnit,
      stopLossOrderMatchingUnit,
      stopLossHistoryOrderUnit,
    );

    if (agentConf.coefficient_fn_str) {
      const portfolioInitAccountInfo = createEmptyAccountInfo(
        `${resolved_account_id}-PF`,
        resolved_currency,
        agentConf.leverage,
        agentConf.initial_balance,
      );
      portfolioHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
      const portfolioOrderMatchingUnit = new OrderMatchingUnit(
        kernel,
        productDataUnit,
        periodDataUnit,
        portfolioHistoryOrderUnit,
      );
      portfolioAccountInfoUnit = new AccountSimulatorUnit(
        kernel,
        productDataUnit,
        quoteDataUnit,
        portfolioHistoryOrderUnit,
        portfolioInitAccountInfo,
      );
      portfolioAccountPerformanceUnit = new AccountPerformanceUnit(kernel, portfolioAccountInfoUnit);
      const portfolioSimulatorUnit = new PortfolioSimulatorUnit(
        kernel,
        agentConf.coefficient_fn_str,
        periodDataUnit,
        productDataUnit,
        {
          [`${resolved_account_id}-SL`]: {
            accountInfoUnit: stopLossAccountInfoUnit,
            accountPerformanceUnit: stopLossAccountPerformanceUnit,
            originAccountInfoUnit: originAccountInfoUnit,
            originAccountPerformanceUnit: originAccountPerformanceUnit,
            historyOrderUnit: stopLossHistoryOrderUnit,
          },
        },
        portfolioAccountInfoUnit,
        portfolioAccountPerformanceUnit,
        portfolioOrderMatchingUnit,
      );
    }
  }
  await agentUnit.execute();

  const accountInfoUnit =
    portfolioAccountInfoUnit ||
    stopLossAccountInfoUnit ||
    counterpartyAccountInfoUnit ||
    positionLimitAccountInfoUnit ||
    originAccountInfoUnit;

  const accountPerformanceUnit =
    portfolioAccountPerformanceUnit ||
    stopLossAccountPerformanceUnit ||
    counterpartyAccountPerformanceUnit ||
    positionLimitAccountPerformanceUnit ||
    originAccountPerformanceUnit;

  const historyOrderUnit =
    portfolioHistoryOrderUnit ||
    stopLossHistoryOrderUnit ||
    counterpartyHistoryOrderUnit ||
    positionLimitHistoryOrderUnit ||
    originHistoryOrderUnit;

  return {
    kernel,
    agentUnit,
    periodDataUnit,
    quoteDataUnit,
    productDataUnit,

    accountInfoUnit,
    accountPerformanceUnit,
    historyOrderUnit,

    originAccountInfoUnit,
    originAccountPerformanceUnit,
    originHistoryOrderUnit,

    counterpartyAccountInfoUnit,
    counterpartyAccountPerformanceUnit,
    counterpartyHistoryOrderUnit,

    stopLossAccountInfoUnit,
    stopLossAccountPerformanceUnit,
    stopLossHistoryOrderUnit,

    portfolioAccountInfoUnit,
    portfolioAccountPerformanceUnit,
    portfolioHistoryOrderUnit,
  };
};
