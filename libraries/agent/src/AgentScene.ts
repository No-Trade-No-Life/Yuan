import {
  AccountInfoUnit,
  AccountPerformanceHubUnit,
  AccountPerformanceMetricsUnit,
  BasicUnit,
  DataLoadingTaskUnit,
  HistoryOrderUnit,
  HistoryPeriodLoadingUnit,
  Kernel,
  KernelFramesMetricsUnit,
  OrderMatchingUnit,
  PeriodDataCheckingUnit,
  PeriodDataUnit,
  PeriodMetricsUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  QuoteMetricsUnit,
  RealtimePeriodLoadingUnit,
  SeriesDataUnit,
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
  /** Kernel ID */
  kernel_id?: string;
  /** 使用标准品种信息 */
  use_general_product?: boolean;
  /** 实盘数据自检时间间隔 */
  period_self_check_interval_in_second?: number;
  /** 允许找不到具体品种信息 */
  allow_fallback_specific_product?: boolean;
  /** 是否禁用打印日志 */
  disable_log?: boolean;
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
    kernel_id: {
      type: 'string',
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
    disable_log: {
      type: 'boolean',
      title: '禁用打印日志',
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

  const resolved_start_timestamp = agentConf.start_time ? Date.parse(agentConf.start_time) : 0;
  const resolved_end_timestamp = agentConf.end_time ? Date.parse(agentConf.end_time) : Date.now();

  const kernel = new Kernel(agentConf.kernel_id);
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
      periodDataUnit,
      agentConf.period_self_check_interval_in_second * 1000,
    );
  }

  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const orderMatchingUnit = new OrderMatchingUnit(
    kernel,
    productDataUnit,
    periodDataUnit,
    historyOrderUnit,
    quoteDataUnit,
  );
  const accountInfoUnit = new AccountInfoUnit(kernel, productDataUnit, quoteDataUnit, historyOrderUnit);

  const accountPerformanceUnit = new AccountPerformanceHubUnit(kernel, accountInfoUnit);
  if (agentConf.publish_account) {
    const unit = new BasicUnit(kernel);
    const mapAccountIdToAccountInfo$: Record<string, Subject<IAccountInfo>> = {};
    accountInfoUnit.mapAccountIdToAccountInfo.forEach((accountInfo) => {
      const accountInfo$ = (mapAccountIdToAccountInfo$[accountInfo.account_id] = new Subject());
      terminal.provideAccountInfo(accountInfo$);
    });
    unit.onIdle = () => {
      for (const accountInfo of accountInfoUnit.mapAccountIdToAccountInfo.values()) {
        const accountInfo$ = mapAccountIdToAccountInfo$[accountInfo.account_id];
        accountInfo$.next(accountInfo);
      }
    };
    unit.onDispose = () => {
      for (const accountInfo$ of Object.values(mapAccountIdToAccountInfo$)) {
        accountInfo$.complete();
      }
    };
    // 装载指标单元
    new KernelFramesMetricsUnit(kernel);
    new QuoteMetricsUnit(kernel, quoteDataUnit);
    new PeriodMetricsUnit(kernel, periodDataUnit);
    new AccountPerformanceMetricsUnit(kernel, accountPerformanceUnit);
    // TODO: clean up when dispose
  }

  const agentUnit = new AgentUnit(kernel, agentCode, agentConf.agent_params || {}, {
    start_time: resolved_start_timestamp,
    end_time: resolved_end_timestamp,
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
