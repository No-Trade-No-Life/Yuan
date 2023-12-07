import { UUID, formatTime, getProfit } from '@yuants/data-model';
import {
  AccountInfoUnit,
  BasicUnit,
  DataLoadingTaskUnit,
  Kernel,
  OrderMatchingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  SeriesDataUnit,
} from '@yuants/kernel';
import { OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import {
  useAccountInfo,
  useEffect,
  useExchange,
  useLog,
  useMemo,
  useMemoAsync,
  useOHLC,
  useParamBoolean,
  useParamNumber,
  useParamOHLC,
  useParamProduct,
  useParamSchema,
  useParamString,
  useProduct,
  useRecordTable,
  useRef,
  useSeries,
  useSinglePosition,
  useState,
} from './hooks';

/**
 * 模型单元
 * @public
 */
export class AgentUnit extends BasicUnit {
  static currentAgent: AgentUnit | null = null;
  orderMatchingUnit: OrderMatchingUnit;
  productDataUnit: ProductDataUnit;
  productLoadingUnit?: ProductLoadingUnit;
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
    this.accountInfoUnit = kernel.units.find(
      (unit): unit is AccountInfoUnit => unit instanceof AccountInfoUnit,
    )!;
    this.orderMatchingUnit = kernel.units.find(
      (unit): unit is OrderMatchingUnit => unit instanceof OrderMatchingUnit,
    )!;
    this.productDataUnit = kernel.units.find(
      (unit): unit is ProductDataUnit => unit instanceof ProductDataUnit,
    )!;

    this.seriesDataUnit = kernel.units.find(
      (unit): unit is SeriesDataUnit => unit instanceof SeriesDataUnit,
    )!;

    this.productLoadingUnit = kernel.units.find(
      (unit): unit is ProductLoadingUnit => unit instanceof ProductLoadingUnit,
    );
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
    ...Object.fromEntries(Object.keys(globalThis).map((key) => [key, undefined])),
    // Supply some global variables
    PositionVariant,
    OrderDirection,
    OrderType,
    useRef,
    useEffect,
    useMemo,
    useMemoAsync,
    useAccountInfo,
    useLog,
    useParamSchema,
    useParamString,
    useParamNumber,
    useParamBoolean,
    useParamProduct,
    useParamOHLC,
    useProduct,
    useOHLC,
    useRecordTable,
    useSinglePosition,
    useExchange,
    useSeries,
    useState,
    formatTime,
    roundToStep,
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
