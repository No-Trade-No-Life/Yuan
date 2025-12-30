import { IAccountInfo, publishAccountInfo } from '@yuants/data-account';
import {
  AccountDatasourceRelationUnit,
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
  PeriodDataUnit,
  PeriodMetricsUnit,
  QuoteDataUnit,
  QuoteMetricsUnit,
  RealtimePeriodLoadingUnit,
  RealtimeTickLoadingUnit,
  SeriesDataUnit,
  TerminateUnit,
  TickDataUnit,
} from '@yuants/kernel';
import { Terminal } from '@yuants/protocol';
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

  /** Kernel ID */
  kernel_id?: string;
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
    kernel_id: {
      type: 'string',
      default: 'Model',
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
  const resolved_end_timestamp =
    !agentConf.is_real && agentConf.end_time ? Date.parse(agentConf.end_time) : Date.now();

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
  new BasicUnit(kernel).onInit = () => {
    for (const periodTask of dataLoadingTaskUnit.periodTasks) {
      periodLoadingUnit.periodTasks.push({ ...periodTask });
    }
  };
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, periodDataUnit);
  if (agentConf.is_real) {
    new BasicUnit(kernel).onInit = () => {
      for (const periodTask of periodLoadingUnit.periodTasks) {
        realtimePeriodLoadingUnit.seriesIdList.push(periodTask.series_id);
      }
    };
    const realtimePeriodLoadingUnit = new RealtimePeriodLoadingUnit(kernel, terminal, periodDataUnit);
    const realtimeTickLoadingUnit = new RealtimeTickLoadingUnit(
      kernel,
      terminal,
      quoteDataUnit,
      tickDataUnit,
    );
  }

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
  if (agentConf.is_real) {
    const unit = new BasicUnit(kernel);
    const mapAccountIdToAccountInfo$: Record<string, Subject<IAccountInfo>> = {};
    unit.onIdle = () => {
      for (const accountInfo of accountInfoUnit.mapAccountIdToAccountInfo.values()) {
        if (!mapAccountIdToAccountInfo$[accountInfo.account_id]) {
          mapAccountIdToAccountInfo$[accountInfo.account_id] = new Subject();
          publishAccountInfo(
            terminal,
            accountInfo.account_id,
            mapAccountIdToAccountInfo$[accountInfo.account_id],
          );
        }
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
