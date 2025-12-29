import { getProfit } from '@yuants/data-product';
import {
  AccountInfoUnit,
  BasicUnit,
  DataLoadingTaskUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  QuoteDataUnit,
  SeriesDataUnit,
  TickDataUnit,
} from '@yuants/kernel';
import { UUID, decodePath, encodePath, formatTime, roundToStep } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import {
  useAccountInfo,
  useEffect,
  useExchange,
  useLog,
  useMemo,
  useMemoAsync,
  useMetric,
  useOHLC,
  useParamSchema,
  useRecordTable,
  useRef,
  useSeries,
  useState,
  useTick,
} from './hooks';

/**
 * 模型单元
 * @public
 */
export class AgentUnit extends BasicUnit {
  static currentAgent: AgentUnit | null = null;
  quoteDataUnit: QuoteDataUnit;
  tickDataUnit: TickDataUnit;
  orderMatchingUnit: OrderMatchingUnit;
  dataLoadingTaskUnit: DataLoadingTaskUnit;
  periodDataUnit: PeriodDataUnit;
  accountInfoUnit: AccountInfoUnit;
  seriesDataUnit: SeriesDataUnit;

  /**
   * @param kernel - 内核
   * @param script - 初始化脚本 (IIFE, 执行后返回值为函数)
   */
  constructor(
    public kernel: Kernel,
    public script: string,
    public params: Record<string, any>,
    public options: {
      start_time: number;
      end_time: number;
    },
  ) {
    super(kernel);
    this.quoteDataUnit = kernel.units.find((unit): unit is QuoteDataUnit => unit instanceof QuoteDataUnit)!;
    this.tickDataUnit = kernel.units.find((unit): unit is TickDataUnit => unit instanceof TickDataUnit)!;
    this.accountInfoUnit = kernel.units.find(
      (unit): unit is AccountInfoUnit => unit instanceof AccountInfoUnit,
    )!;
    this.orderMatchingUnit = kernel.units.find(
      (unit): unit is OrderMatchingUnit => unit instanceof OrderMatchingUnit,
    )!;

    this.seriesDataUnit = kernel.units.find(
      (unit): unit is SeriesDataUnit => unit instanceof SeriesDataUnit,
    )!;

    this.periodDataUnit = kernel.units.find(
      (unit): unit is PeriodDataUnit => unit instanceof PeriodDataUnit,
    )!;

    // TODO: load product using DataLoadingTaskUnit
    this.dataLoadingTaskUnit = kernel.units.find(
      (unit): unit is DataLoadingTaskUnit => unit instanceof DataLoadingTaskUnit,
    )!;

    this.runScript = makeScriptRunner(script);
  }

  private runScript: () => any;

  private _hooks: Array<{ current: any }> = [];
  private _hookIdx = 0;

  useRef = <T>(initialValue: T): { current: T } =>
    (this._hooks[this._hookIdx++] ??= { current: initialValue });

  execute() {
    AgentUnit.currentAgent = this;
    this._hookIdx = 0;
    return this.runScript();
  }

  onEvent(): void | Promise<void> {
    return this.execute();
  }

  cleanups = new Set<() => void>();

  onDispose(): void | Promise<void> {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
  }

  paramsSchema: JSONSchema7 = { type: 'object', properties: {} };

  record_table: Record<string, Record<string, any>[]> = {};

  dump() {
    return {
      hooks: this._hooks.map((x) => x.current),
      record_table: this.record_table,
    };
  }

  restore(state: any): void {
    this._hooks = state.hooks;
    this.record_table = state.record_table;
  }
}

function makeScriptRunner(script: string): () => any {
  const globalContext = {
    // Issue: block access to globalThis and its properties for security
    globalThis: {},
    ...Object.fromEntries(
      Object.keys(globalThis)
        // Issue: Must be identifier, may throw Error: unexpected number
        .filter((key) => key.match(/^[_A-Za-z][_A-Za-z0-9]+$/))
        .map((key) => [key, undefined]),
    ),
    // Supply some global variables
    useRef,
    useEffect,
    useMemo,
    useMemoAsync,
    useAccountInfo,
    useLog,
    useParamSchema,
    useOHLC,
    useTick,
    useRecordTable,
    useExchange,
    useSeries,
    useMetric,
    useState,
    formatTime,
    roundToStep,
    encodePath,
    decodePath,
    getProfit,
    UUID,
  };

  const x = Object.entries(globalContext);

  const module = new Function(...x.map((x) => x[0]), `return ${script}`)(...x.map((x) => x[1]));
  if (module.__esModule) {
    if (typeof module.default === 'function') {
      return module.default;
    }
    throw new Error(`Module must export default function`);
  }
  if (typeof module !== 'function') {
    throw new Error('Module must export default function');
  }
  return module;
}
