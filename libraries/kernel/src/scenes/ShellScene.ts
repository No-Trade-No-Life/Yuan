import { IAccountInfo, Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { Subject } from 'rxjs';
import { v4 } from 'uuid';
import { Kernel } from '../kernel';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  HistoryOrderUnit,
  HistoryPeriodLoadingUnit,
  OrderMatchingUnit,
  PeriodDataCheckingUnit,
  PeriodDataUnit,
  PortfolioSimulatorUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  RealtimePeriodLoadingUnit,
  ScriptUnit,
  SeriesDataUnit,
  StopLossOrderMapperUnit,
} from '../units';
import { AccountPerformanceMetricsUnit } from '../units/metrics/AccountPerformanceMetricsUnit';
import { KernelFramesMetricsUnit } from '../units/metrics/KernelFramesMetricsUnit';
import { PeriodMetricsUnit } from '../units/metrics/PeriodMetricsUnit';
import { QuoteMetricsUnit } from '../units/metrics/QuoteMetricsUnit';
import { createEmptyAccountInfo } from '../utils';

/**
 * Shell 配置
 * @public
 */
export interface IShellConf {
  /** 主代码路径 */
  script_path: string;
  /** 主代码参数 */
  script_params?: Record<string, any>;

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
}

/**
 * Shell Conf 的 JSON Schema
 * @public
 */
export const shellConfSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    script_path: {
      type: 'string',
      title: '主代码路径',
      description: '代码入口文件的路径',
    },
    script_params: {
      type: 'object',
      title: '主代码参数',
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
  },
};

/**
 * 品种配置
 *
 * @public
 */
export const productsSchema: JSONSchema7 = {
  title: '品种配置',
  type: 'array',
  items: {
    type: 'object',
    properties: {
      datasource_id: {
        title: '数据源ID',
        type: 'string',
      },
      product_id: {
        title: '品种ID',
        type: 'string',
      },
      name: {
        title: '品种名',
        type: 'string',
        description: '人类易读的品种名称',
      },
      base_currency: {
        title: '基准货币',
        type: 'string',
        description:
          '基准货币是汇率报价中作为基础的货币，即报价表达形式为每一个单位的货币可兑换多少另一种货币。',
      },
      quoted_currency: {
        title: '标价货币',
        type: 'string',
        description:
          '汇率的表达方式为一单位的基准货币可兑换多少单位的标价货币\n对于非外汇品种，quoted_currency 应当为空。',
      },

      is_underlying_base_currency: {
        title: '是否标的基准货币',
        type: 'boolean',
        description:
          '标的物是基准货币吗？\n如果此值为 true，需要在标准收益公式中额外除以本品种的"平仓时的价格"。',
      },
      price_step: {
        title: '报价粒度',
        type: 'number',
        description: '市场报价，委托价都必须为此值的整数倍，不得有浮点误差',
      },
      volume_step: {
        title: '成交量粒度',
        type: 'number',
        description: '委托量、成交量、持仓量都必须为此值的整数倍，不得有浮点误差',
      },
      value_speed: {
        title: '价值速率',
        type: 'number',
        description: '交易 1 手对应的标的资产数量',
      },
      margin_rate: {
        title: '保证金率',
        type: 'number',
        description: `
          保证金 = 持仓量 * 持仓价 * 价值速率 * 保证金率 / 账户杠杆率
        `,
      },
      value_based_cost: {
        title: '基于价值的成本',
        type: 'number',
        description: `
        产生与成交额成正比的结算资产成本，例如:
        1. 按成交额收取的手续费
        `,
      },
      volume_based_cost: {
        title: '基于成交量的成本',
        type: 'number',
        description: `
        产生与成交量成正比的结算资产成本，例如:
        1. 按成交量收取的手续费; 
        2. 滑点等交易实况造成的不利价差。
        `,
      },
      max_position: {
        title: '最大持仓量',
        type: 'number',
      },
      max_volume: {
        title: '最大单笔委托量',
        type: 'number',
      },
      min_volume: {
        title: '最小单笔委托量',
        type: 'number',
      },
      allow_long: {
        title: '允许做多',
        type: 'boolean',
        default: true,
      },
      allow_short: {
        title: '允许做空',
        type: 'boolean',
        default: true,
      },
      spread: {
        title: '点差',
        type: 'number',
      },
    },
  },
};
/**
 * Shell 场景 (模型实盘/回测)
 *
 * @public
 */
export const ShellScene = async (
  terminal: Terminal,
  shellConf: IShellConf,
  scriptResolver: { readFile: (path: string) => Promise<string> },
) => {
  const resolved_account_id = shellConf.account_id || v4();
  const resolved_currency = shellConf.currency || 'YYY';

  const resolved_start_timestamp = shellConf.start_time ? Date.parse(shellConf.start_time) : 0;
  const resolved_end_timestamp = shellConf.end_time ? Date.parse(shellConf.end_time) : Date.now();

  const kernel = new Kernel();
  if (shellConf.disable_log) {
    kernel.log = undefined;
  }
  const productDataUnit = new ProductDataUnit(kernel);
  const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit, {
    use_general_product: shellConf.use_general_product,
    allow_fallback_specific_product: shellConf.allow_fallback_specific_product,
  });
  const quoteDataUnit = new QuoteDataUnit(kernel);
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const seriesDataUnit = new SeriesDataUnit(kernel);
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, productDataUnit, periodDataUnit);
  if (shellConf.is_real) {
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
  if (shellConf.period_self_check_interval_in_second) {
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
      shellConf.period_self_check_interval_in_second * 1000,
    );
  }

  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const orderMatchingUnit = new OrderMatchingUnit(kernel, productDataUnit, periodDataUnit, historyOrderUnit);
  const accountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    historyOrderUnit,
    createEmptyAccountInfo(
      resolved_account_id,
      resolved_currency,
      shellConf.leverage,
      shellConf.initial_balance,
    ),
  );
  const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);
  if (shellConf.publish_account) {
    const unit = new BasicUnit(kernel);
    const accountInfo$ = new Subject<IAccountInfo>();
    terminal.provideAccountInfo(accountInfo$);
    unit.onIdle = () => {
      accountInfo$.next(accountInfoUnit.accountInfo);
    };
    // 装载指标单元
    const account_id = accountInfoUnit.accountInfo.account_id;
    const kernelFramesMetricsUnit = new KernelFramesMetricsUnit(kernel, account_id);
    const quoteMetricsUnit = new QuoteMetricsUnit(kernel, account_id, quoteDataUnit);
    const periodMetricsUnit = new PeriodMetricsUnit(kernel, account_id, periodDataUnit);
    const accountPerformanceMetricsUnit = new AccountPerformanceMetricsUnit(kernel, accountPerformanceUnit);
    // TODO: clean up when dispose
  }

  const scriptUnit = new ScriptUnit(
    kernel,
    productDataUnit,
    productLoadingUnit,
    periodLoadingUnit,
    periodDataUnit,
    orderMatchingUnit,
    accountInfoUnit,
    seriesDataUnit,
    scriptResolver,
    shellConf.script_path,
    shellConf.script_params || {},
    {
      start_time: resolved_start_timestamp,
      end_time: resolved_end_timestamp,
    },
  );

  let stopLossAccountInfoUnit: AccountSimulatorUnit | undefined;
  let stopLossAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let stopLossHistoryOrderUnit: HistoryOrderUnit | undefined;

  let portfolioAccountInfoUnit: AccountSimulatorUnit | undefined;
  let portfolioAccountPerformanceUnit: AccountPerformanceUnit | undefined;
  let portfolioHistoryOrderUnit: HistoryOrderUnit | undefined;

  if (shellConf.resume_on_source_margin_below) {
    // TODO: 止损信号
    const stopLossInitAccountInfo = createEmptyAccountInfo(
      `${resolved_account_id}-SL`,
      resolved_currency,
      shellConf.leverage,
      shellConf.initial_balance,
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
      shellConf.resume_on_source_margin_below,
      productDataUnit,
      quoteDataUnit,
      accountInfoUnit,
      accountPerformanceUnit,
      historyOrderUnit,
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
    if (shellConf.publish_account) {
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

    if (shellConf.coefficient_fn_str) {
      const portfolioInitAccountInfo = createEmptyAccountInfo(
        `${resolved_account_id}-PF`,
        resolved_currency,
        shellConf.leverage,
        shellConf.initial_balance,
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
        shellConf.coefficient_fn_str,
        periodDataUnit,
        productDataUnit,
        {
          [`${resolved_account_id}-SL`]: {
            accountInfoUnit: stopLossAccountInfoUnit,
            accountPerformanceUnit: stopLossAccountPerformanceUnit,
            originAccountInfoUnit: accountInfoUnit,
            originAccountPerformanceUnit: accountPerformanceUnit,
            historyOrderUnit: stopLossHistoryOrderUnit,
          },
        },
        portfolioAccountInfoUnit,
        portfolioAccountPerformanceUnit,
        portfolioOrderMatchingUnit,
      );
      if (shellConf.publish_account) {
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

  await scriptUnit.init(); // 加载脚本，初始化所有需要加载的数据任务
  return {
    kernel,
    accountInfoUnit,
    accountPerformanceUnit,
    scriptUnit,
    periodDataUnit,
    quoteDataUnit,
    productDataUnit,
    historyOrderUnit,
    stopLossAccountInfoUnit,
    stopLossAccountPerformanceUnit,
    stopLossHistoryOrderUnit,
    portfolioAccountInfoUnit,
    portfolioAccountPerformanceUnit,
    portfolioHistoryOrderUnit,
  };
};
