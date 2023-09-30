import { UUID } from '@yuants/data-model';
import {
  AccountPerformanceMetricsUnit,
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  CounterpartyOrderMappingUnit,
  DataLoadingTaskUnit,
  HistoryOrderUnit,
  HistoryPeriodLoadingUnit,
  Kernel,
  KernelFramesMetricsUnit,
  OrderMatchingUnit,
  PeriodDataCheckingUnit,
  PeriodDataUnit,
  PeriodMetricsUnit,
  PortfolioSimulatorUnit,
  PositionLimitOrderMappingUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  QuoteMetricsUnit,
  RealtimePeriodLoadingUnit,
  SeriesDataUnit,
  StopLossOrderMapperUnit,
  createEmptyAccountInfo,
} from '@yuants/kernel';
import { IAccountInfo, Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { Subject } from 'rxjs';
import { AgentUnit } from './AgentUnit';

/**
 * @public
 */
export interface IAgentConf {
  /** 模型入口路径 */
  entry?: string;
  /** 模型代码 */
  bundled_code?: string;
  /** 自定义参数 */
  agent_params?: Record<string, any>;

  /** 实盘模式 */
  is_real?: boolean;
  /** 历史数据开始时间 */
  start_time?: string;
  /** 历史数据结束时间 */
  end_time?: string;

  /** 发布账户到主机 */
  publish_account?: boolean;
  /** 发布账户 ID */
  account_id?: string;
  /** 初始余额 */
  initial_balance?: number;
  /** 账户保证金货币 */
  currency?: string;
  /** 系统杠杆率 */
  leverage?: number;
  /** 使用标准品种信息 */
  use_general_product?: boolean;
  /** 实盘数据自检时间间隔 */
  period_self_check_interval_in_second?: number;
  /** 允许找不到具体品种信息 */
  allow_fallback_specific_product?: boolean;
  /** 止损后恢复开仓的保证金阈值（小于） */
  resume_on_source_margin_below?: number;
  /** 仓位映射函数 */
  coefficient_fn_str?: string;
  /** 是否禁用打印日志 */
  disable_log?: boolean;
  /** 是否作为对手盘交易（反向开平仓） */
  as_counterparty?: boolean;
  /** Position Limit (Maximum Position) */
  position_limit?: number;
}

/**
 * @public
 */
export const agentConfSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    entry: {
      type: 'string',
      title: '模型入口路径',
    },
    agent_params: {
      type: 'object',
      title: '自定义参数',
    },
    is_real: {
      type: 'boolean',
      title: '实盘模式',
      description: '实盘模式下会订阅实时行情，非实盘模式即历史回测模式',
      default: false,
    },
    start_time: {
      type: 'string',
      title: '历史数据开始时间',
      description:
        '提前拉取历史数据的区间起点；实盘时如果留空表示不拉取，非实盘时留空表示拉取无穷早的数据；时区按照本地时区填写',
      format: 'date-time',
    },
    end_time: {
      type: 'string',
      title: '历史数据结束时间',
      description:
        '提前拉取历史数据的区间终点；实盘时强制设定为当前时间，非实盘时留空表示拉取无穷晚的数据；时区按照本地时区填写',
      format: 'date-time',
    },
    publish_account: {
      type: 'boolean',
      title: '发布账户到主机',
      description: '同意将此次运行的模拟账户信息流、历史订单、品种参数配置发布到主机',
    },
    account_id: {
      type: 'string',
      title: '账户ID',
    },
    initial_balance: {
      type: 'number',
      title: '初始余额',
    },
    currency: {
      type: 'string',
      title: '账户的保证金货币',
    },
    leverage: {
      type: 'number',
      title: '账户系统杠杆率',
      default: 1,
    },
    use_general_product: {
      type: 'boolean',
      title: '使用标准品种信息',
      description: '使用标准品种信息作为品种信息，但仍沿用具体品种的行情数据',
      default: false,
    },
    period_self_check_interval_in_second: {
      type: 'number',
      title: '自检周期（秒）',
      description: '每隔多少秒进行一次自检 (0 = 不自检)',
      default: 0,
    },
    allow_fallback_specific_product: {
      type: 'boolean',
      title: '允许找不到具体品种信息',
    },
    resume_on_source_margin_below: {
      type: 'number',
      title: '恢复交易的使用保证金线',
    },
    coefficient_fn_str: {
      type: 'string',
      title: '仓位映射函数',
    },
    disable_log: {
      type: 'boolean',
      title: '禁用打印日志',
    },
    as_counterparty: {
      type: 'boolean',
      title: '是否作为对手盘交易（反向开平仓）',
    },
    position_limit: {
      type: 'number',
      title: '仓位限制',
    },
  },
};

/**
 * 模型场景 (模型实盘/回测)
 *
 * @public
 */
export const AgentScene = async (terminal: Terminal, agentConf: IAgentConf) => {
  const agentCode = agentConf.bundled_code;
  if (!agentCode) throw new Error(`agentConf.bundled_code is required`);
  const resolved_account_id = agentConf.account_id || UUID();
  const resolved_currency = agentConf.currency || 'YYY';

  const resolved_start_timestamp = agentConf.start_time ? Date.parse(agentConf.start_time) : 0;
  const resolved_end_timestamp = agentConf.end_time ? Date.parse(agentConf.end_time) : Date.now();

  const kernel = new Kernel();
  if (agentConf.disable_log) {
    kernel.log = undefined;
  }
  const productDataUnit = new ProductDataUnit(kernel);
  const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit, {
    use_general_product: agentConf.use_general_product,
    allow_fallback_specific_product: agentConf.allow_fallback_specific_product,
  });
  const quoteDataUnit = new QuoteDataUnit(kernel);
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const seriesDataUnit = new SeriesDataUnit(kernel);
  const dataLoadingTaskUnit = new DataLoadingTaskUnit(kernel);
  new BasicUnit(kernel).onInit = () => {
    for (const periodTask of dataLoadingTaskUnit.periodTasks) {
      periodLoadingUnit.periodTasks.push({ ...periodTask });
    }
  };
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, productDataUnit, periodDataUnit);
  if (agentConf.is_real) {
    new BasicUnit(kernel).onInit = () => {
      for (const periodTask of periodLoadingUnit.periodTasks) {
        realtimePeriodLoadingUnit.periodTasks.push({ ...periodTask });
      }
    };
    const realtimePeriodLoadingUnit = new RealtimePeriodLoadingUnit(
      kernel,
      terminal,
      productDataUnit,
      periodDataUnit,
    );
  }
  if (agentConf.period_self_check_interval_in_second) {
    new BasicUnit(kernel).onInit = () => {
      for (const periodTask of periodLoadingUnit.periodTasks) {
        dataCheckingUnit.periodTasks.push({ ...periodTask });
      }
    };
    const dataCheckingUnit = new PeriodDataCheckingUnit(
      kernel,
      terminal,
      resolved_account_id,
      periodDataUnit,
      agentConf.period_self_check_interval_in_second * 1000,
    );
  }

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
  if (agentConf.publish_account) {
    const unit = new BasicUnit(kernel);
    const accountInfo$ = new Subject<IAccountInfo>();
    terminal.provideAccountInfo(accountInfo$);
    unit.onIdle = () => {
      accountInfo$.next(originAccountInfoUnit.accountInfo);
    };
    // 装载指标单元
    const account_id = originAccountInfoUnit.accountInfo.account_id;
    const kernelFramesMetricsUnit = new KernelFramesMetricsUnit(kernel, account_id);
    const quoteMetricsUnit = new QuoteMetricsUnit(kernel, account_id, quoteDataUnit);
    const periodMetricsUnit = new PeriodMetricsUnit(kernel, account_id, periodDataUnit);
    const accountPerformanceMetricsUnit = new AccountPerformanceMetricsUnit(
      kernel,
      originAccountPerformanceUnit,
    );
    // TODO: clean up when dispose
  }

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
    if (agentConf.publish_account) {
      const unit = new BasicUnit(kernel);
      const accountInfo$ = new Subject<IAccountInfo>();
      terminal.provideAccountInfo(accountInfo$);
      unit.onIdle = () => {
        accountInfo$.next(counterpartyAccountInfoUnit!.accountInfo);
      };
      // 装载指标单元
      const account_id = counterpartyAccountPerformanceUnit.performance.account_id;
      const kernelFramesMetricsUnit = new KernelFramesMetricsUnit(kernel, account_id);
      const quoteMetricsUnit = new QuoteMetricsUnit(kernel, account_id, quoteDataUnit);
      const periodMetricsUnit = new PeriodMetricsUnit(kernel, account_id, periodDataUnit);
      const reverseDirectionAccountMetricsUnit = new AccountPerformanceMetricsUnit(
        kernel,
        counterpartyAccountPerformanceUnit,
      );
      // TODO: clean up when dispose
    }
  }

  let stopLossAccountInfoUnit: AccountSimulatorUnit | undefined;
  let stopLossAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let stopLossHistoryOrderUnit: HistoryOrderUnit | undefined;

  let portfolioAccountInfoUnit: AccountSimulatorUnit | undefined;
  let portfolioAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let portfolioHistoryOrderUnit: HistoryOrderUnit | undefined;

  if (agentConf.resume_on_source_margin_below) {
    // TODO: 止损信号
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

    new StopLossOrderMapperUnit(
      kernel,
      stopLossInitAccountInfo.account_id,
      agentConf.resume_on_source_margin_below,
      productDataUnit,
      quoteDataUnit,
      originAccountInfoUnit,
      originAccountPerformanceUnit,
      originHistoryOrderUnit,
      stopLossOrderMatchingUnit,
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
    if (agentConf.publish_account) {
      const unit = new BasicUnit(kernel);
      const accountInfo$ = new Subject<IAccountInfo>();
      terminal.provideAccountInfo(accountInfo$);
      unit.onIdle = () => {
        accountInfo$.next(stopLossAccountInfoUnit!.accountInfo);
      };
      // 装载指标单元
      const account_id = stopLossAccountPerformanceUnit.performance.account_id;
      const kernelFramesMetricsUnit = new KernelFramesMetricsUnit(kernel, account_id);
      const quoteMetricsUnit = new QuoteMetricsUnit(kernel, account_id, quoteDataUnit);
      const periodMetricsUnit = new PeriodMetricsUnit(kernel, account_id, periodDataUnit);
      const stopLossAccountMetricsUnit = new AccountPerformanceMetricsUnit(
        kernel,
        stopLossAccountPerformanceUnit,
      );
      // TODO: clean up when dispose
    }

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
      if (agentConf.publish_account) {
        const unit = new BasicUnit(kernel);
        const accountInfo$ = new Subject<IAccountInfo>();
        terminal.provideAccountInfo(accountInfo$);
        unit.onIdle = () => {
          accountInfo$.next(portfolioAccountInfoUnit!.accountInfo);
        };

        // 装载指标单元
        const account_id = portfolioAccountPerformanceUnit.performance.account_id;
        const kernelFramesMetricsUnit = new KernelFramesMetricsUnit(kernel, account_id);
        const quoteMetricsUnit = new QuoteMetricsUnit(kernel, account_id, quoteDataUnit);
        const periodMetricsUnit = new PeriodMetricsUnit(kernel, account_id, periodDataUnit);
        const portfolioAccountMetricsUnit = new AccountPerformanceMetricsUnit(
          kernel,
          portfolioAccountPerformanceUnit,
        );
        // TODO: clean up when dispose
      }
    }
  }
  await agentUnit.execute();

  // these lines of code implies that there is a certain priority of units,
  // maybe we should make it more explicit.
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
