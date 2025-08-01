## API Report File for "@yuants/kernel"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { IAccountInfo } from '@yuants/data-model';
import { IOrder } from '@yuants/data-model';
import { IPeriod } from '@yuants/data-model';
import { IPosition } from '@yuants/data-model';
import { IProduct } from '@yuants/data-product';
import { ITick } from '@yuants/data-model';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { Terminal } from '@yuants/protocol';

// @public (undocumented)
export class AccountDatasourceRelationUnit extends BasicUnit {
    // (undocumented)
    dump(): any;
    // Warning: (ae-forgotten-export) The symbol "IAccountDatasourceRelation" needs to be exported by the entry point index.d.ts
    //
    // (undocumented)
    list(): IAccountDatasourceRelation[];
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    updateRelation(relation: IAccountDatasourceRelation): void;
}

// @public (undocumented)
export class AccountInfoUnit extends BasicUnit {
    constructor(kernel: Kernel, productDataUnit: ProductDataUnit, quoteDataUnit: QuoteDataUnit, historyOrderUnit: HistoryOrderUnit);
    // (undocumented)
    dump(): {
        mapAccountIdToAccountInfo: {
            [k: string]: IAccountInfo;
        };
        mapAccountIdToBalance: Record<string, number>;
        mapAccountIdToPositionIdToPosition: Record<string, Record<string, IPosition>>;
        orderIdx: number;
    };
    // (undocumented)
    getPosition: (account_id: string, position_id: string, product_id: string, direction: string) => IPosition;
    // (undocumented)
    historyOrderUnit: HistoryOrderUnit;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    mapAccountIdToAccountInfo: Map<string, IAccountInfo>;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): void | Promise<void>;
    // (undocumented)
    orderIdx: number;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    updateAccountInfo(accountId: string): void;
    // (undocumented)
    useAccount(account_id: string, currency: string, leverage?: number, initial_balance?: number): IAccountInfo;
}

// @public (undocumented)
export class AccountPerformanceHubUnit extends BasicUnit {
    constructor(kernel: Kernel, accountInfoUnit: AccountInfoUnit);
    // (undocumented)
    accountInfoUnit: AccountInfoUnit;
    // (undocumented)
    dump(): {
        mapAccountIdToPerformance: {
            [k: string]: IAccountPerformance;
        };
    };
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    mapAccountIdToPerformance: Map<string, IAccountPerformance>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    restore(state: any): void;
}

// @public (undocumented)
export class AccountPerformanceMetricsUnit extends BasicUnit {
    constructor(kernel: Kernel, accountPerformanceUnit: AccountPerformanceHubUnit);
    // (undocumented)
    accountPerformanceUnit: AccountPerformanceHubUnit;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
}

// @public
export class AccountPerformanceUnit extends BasicUnit {
    constructor(kernel: Kernel, accountUnit: AccountSimulatorUnit);
    // (undocumented)
    accountUnit: AccountSimulatorUnit;
    // (undocumented)
    dump(): {
        performance: IAccountPerformance;
    };
    // (undocumented)
    kernel: Kernel;
    static makeInitAccountPerformance: (account_id: string) => IAccountPerformance;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    performance: IAccountPerformance;
    static reduceAccountPerformance: (acc: IAccountPerformance, cur: IAccountInfo) => IAccountPerformance;
    // (undocumented)
    restore(state: any): void;
}

// @public
export const AccountReplayScene: (terminal: Terminal, account_id: string, currency: string, leverage: number, start_timestamp: number, end_timestamp: number, duration: string, datasource_id?: string) => {
    kernel: Kernel;
    accountInfoUnit: AccountInfoUnit;
    accountPerformanceUnit: AccountPerformanceHubUnit;
};

// @public @deprecated
export class AccountSimulatorUnit extends BasicUnit {
    constructor(kernel: Kernel, productDataUnit: ProductDataUnit, quoteDataUnit: QuoteDataUnit, historyOrderUnit: HistoryOrderUnit, accountInfo: IAccountInfo);
    // (undocumented)
    accountInfo: IAccountInfo;
    // (undocumented)
    getPosition(position_id: string, product_id: string, direction: string): IPosition;
    // (undocumented)
    historyOrderUnit: HistoryOrderUnit;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void;
    // (undocumented)
    onInit(): void | Promise<void>;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
}

// @public
export class BasicUnit implements IKernelUnit {
    constructor(kernel: Kernel);
    // (undocumented)
    dump(): {};
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onIdle(): void | Promise<void>;
    // (undocumented)
    onInit(): void | Promise<void>;
    // (undocumented)
    restore(state: any): void;
}

// @public (undocumented)
export class DataLoadingTaskUnit extends BasicUnit {
    constructor(kernel: Kernel);
    // (undocumented)
    dump(): {
        periodTasks: {
            datasource_id: string;
            product_id: string;
            duration: string;
            start_time_in_us: number;
            end_time_in_us: number;
        }[];
        productTasks: {
            datasource_id: string;
            product_id: string;
        }[];
    };
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    periodTasks: {
        datasource_id: string;
        product_id: string;
        duration: string;
        start_time_in_us: number;
        end_time_in_us: number;
    }[];
    // (undocumented)
    productTasks: {
        datasource_id: string;
        product_id: string;
    }[];
    // (undocumented)
    restore(state: any): void;
}

// @public @deprecated
export const diffPosition: (source: IPosition[], target: IPosition[]) => IPositionDiff[];

// @public
export const getMargin: (product: IProduct, openPrice: number, volume: number, direction: string, currency: string, quote: (product_id: string) => {
    ask: number;
    bid: number;
} | undefined) => number;

// @public
export const getProfit: (product: IProduct, openPrice: number, closePrice: number, volume: number, direction: string, currency: string, quotes: (product_id: string) => {
    ask: number;
    bid: number;
} | undefined) => number;

// @public
export class HistoryOrderUnit extends BasicUnit {
    constructor(kernel: Kernel, quoteDataUnit: QuoteDataUnit, productDataUnit: ProductDataUnit);
    // (undocumented)
    dump(): {
        historyOrders: IOrder[];
    };
    historyOrders: IOrder[];
    // (undocumented)
    kernel: Kernel;
    orderUpdated$: Observable<IOrder>;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
    // (undocumented)
    restore(state: any): void;
    updateOrder(order: IOrder): void;
}

// @public
export class HistoryPeriodLoadingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, productDataUnit: ProductDataUnit, periodDataUnit: PeriodDataUnit);
    // (undocumented)
    dump(): {
        periodTasks: {
            datasource_id: string;
            product_id: string;
            duration: string;
            start_time_in_us: number;
            end_time_in_us: number;
        }[];
        mapEventIdToPeriod: {
            [k: string]: IPeriod;
        };
    };
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): Promise<void>;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
    // (undocumented)
    periodTasks: {
        datasource_id: string;
        product_id: string;
        duration: string;
        start_time_in_us: number;
        end_time_in_us: number;
    }[];
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    terminal: Terminal;
}

// @public
export interface IAccountPerformance {
    // (undocumented)
    account_id: string;
    avg_profit_per_day: number;
    capital_occupancy_rate: number;
    // (undocumented)
    currency: string;
    daily_return_ratio: number;
    // (undocumented)
    _daily_return_ratio_list: number[];
    daily_sharpe_ratio: number;
    daily_sortino_ratio: number;
    drawdown: number;
    equity: number;
    equity_base: number;
    expect_everyday_downside_profit: number;
    expect_everyday_profit: number;
    expect_everyweek_downside_profit: number;
    expect_everyweek_profit: number;
    expect_squared_everyday_downside_profit: number;
    expect_squared_everyday_profit: number;
    expect_squared_everyweek_downside_profit: number;
    expect_squared_everyweek_profit: number;
    first_order_timestamp: number;
    // (undocumented)
    first_timestamp: number;
    // (undocumented)
    _history_position_performance: IAccountPositionPerformance[];
    // (undocumented)
    _history_weekly_equity: Array<{
        high: number;
        low: number;
    }>;
    integral_maintenance_margin: number;
    maintenance_margin: number;
    max_drawdown: number;
    max_equity: number;
    max_equity_base: number;
    max_maintenance_margin: number;
    max_used_margin: number;
    min_profit_interquartile_range: number;
    min_profit_lower_fence: number;
    min_profit_lower_fence_out_count: number;
    min_profit_p25: number;
    min_profit_p75: number;
    opening_equity: number;
    payback_period_in_days: number;
    // Warning: (ae-forgotten-export) The symbol "IAccountPositionPerformance" needs to be exported by the entry point index.d.ts
    //
    // (undocumented)
    _position_performance_list: Record<string, IAccountPositionPerformance>;
    profit_drawdown_ratio: number;
    this_week_first_equity: number;
    this_week_profit: number;
    // (undocumented)
    timestamp: number;
    today_first_equity: number;
    today_profit: number;
    total_days: number;
    total_downside_days: number;
    total_downside_weeks: number;
    total_positions: number;
    total_weeks: number;
    volatility_everyday_downside_profit: number;
    volatility_everyday_profit: number;
    volatility_everyweek_downside_profit: number;
    volatility_everyweek_profit: number;
    // (undocumented)
    _weekly_equity: number[];
    // (undocumented)
    _weekly_first_timestamp: number[];
    weekly_return_ratio: number;
    // (undocumented)
    _weekly_return_ratio_list: number[];
    weekly_sharpe_ratio: number;
    weekly_sortino_ratio: number;
    yearly_return_ratio: number;
}

// @public
export interface IKernelUnit {
    dump(): any;
    kernel: Kernel;
    onDispose(): void | Promise<void>;
    onEvent(): void | Promise<void>;
    onIdle(): void | Promise<void>;
    onInit(): void | Promise<void>;
    restore(state: any): void;
}

// @public (undocumented)
export interface IPortfolioStatistics {
    // (undocumented)
    coefficients: Record<string, number>;
    // (undocumented)
    period_end_target_account_info: IAccountInfo;
    // (undocumented)
    period_source_account_statistics: Record<string, {
        start_account_info: IAccountInfo;
        end_account_info: IAccountInfo;
        performance: IAccountPerformance;
    }>;
    // (undocumented)
    period_start_target_account_info: IAccountInfo;
    // (undocumented)
    start_timestamp: number;
    // (undocumented)
    target_account_performance: IAccountPerformance;
}

// @public (undocumented)
export interface IPositionDiff {
    direction: string;
    error_volume: number;
    product_id: string;
    volume_in_source: number;
    volume_in_target: number;
}

// @public
export class Kernel {
    constructor(id?: string);
    addUnit(unit: IKernelUnit): void;
    alloc(timestamp: number): number;
    chronologicErrors: number;
    currentEventId: number;
    currentTimestamp: number;
    // (undocumented)
    dump: () => {
        kernel: {
            id: string;
            eventCnt: number;
            currentEventId: number;
            currentTimestamp: number;
            status: "created" | "initializing" | "running" | "terminating" | "terminated" | "idle";
            isTerminating: boolean;
            queue: number[][];
        };
        units: any[];
    };
    // (undocumented)
    findUnit<T extends IKernelUnit>(Unit: new (...args: any[]) => T): T | undefined;
    // (undocumented)
    findUnits<T extends IKernelUnit>(Unit: new (...args: any[]) => T): T[];
    // (undocumented)
    id: string;
    log: ((...params: any[]) => void) | undefined;
    // (undocumented)
    restore: (state: any) => void;
    start(): Promise<void>;
    status: 'created' | 'initializing' | 'running' | 'terminating' | 'terminated' | 'idle';
    terminate(): void;
    units: IKernelUnit[];
}

// @public (undocumented)
export class KernelFramesMetricsUnit extends BasicUnit {
    constructor(kernel: Kernel);
    // (undocumented)
    frameCnt: number;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
}

// @public
export const mergePositions: (positions: IPosition[]) => IPosition[];

// @public
export class OrderLoadingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, historyOrderUnit: HistoryOrderUnit);
    // (undocumented)
    historyOrderUnit: HistoryOrderUnit;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): Promise<void>;
    relatedProductIds: Set<string>;
    // (undocumented)
    tasks: {
        account_id: string;
        start_time: number;
        end_time: number;
    }[];
    // (undocumented)
    terminal: Terminal;
}

// @public
export class OrderMatchingUnit extends BasicUnit {
    constructor(kernel: Kernel, productDataUnit: ProductDataUnit, periodDataUnit: PeriodDataUnit, tickDataUnit: TickDataUnit, accountInfoUnit: AccountInfoUnit, historyOrderUnit: HistoryOrderUnit, quoteDataUnit: QuoteDataUnit);
    // (undocumented)
    accountInfoUnit: AccountInfoUnit;
    // (undocumented)
    cancelOrder(...orderIds: string[]): void;
    // (undocumented)
    dump(): {
        mapOrderIdToOrder: Map<string, IOrder>;
        mapProductIdToRange: Map<string, {
            ask: IMatchingRange;
            bid: IMatchingRange;
        }>;
        prevPeriodMap: Record<string, IPeriod>;
    };
    // (undocumented)
    getOrderById(id: string): IOrder | undefined;
    // (undocumented)
    historyOrderUnit: HistoryOrderUnit;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    listOrders(): IOrder[];
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): void | Promise<void>;
    orderCancelled$: Observable<string[]>;
    orderSubmitted$: Observable<IOrder[]>;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    submitOrder(...orders: IOrder[]): void;
    // (undocumented)
    tickDataUnit: TickDataUnit;
}

// @public
export const OrderMergeReplayScene: (kernel: Kernel, init_account_info: IAccountInfo, periods: IPeriod[], orders: IOrder[], products: IProduct[]) => {
    kernel: Kernel;
    accountInfoUnit: AccountSimulatorUnit;
    accountPerformanceUnit: AccountPerformanceUnit;
    productDataUnit: ProductDataUnit;
    quoteDataUnit: QuoteDataUnit;
    periodDataUnit: PeriodDataUnit;
};

// @public
export class PeriodDataCheckingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, periodDataUnit: PeriodDataUnit);
    // (undocumented)
    errorTotal: number;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onInit(): void;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
    // (undocumented)
    periodTasks: {
        datasource_id: string;
        product_id: string;
        duration: string;
        start_time_in_us: number;
    }[];
    // (undocumented)
    terminal: Terminal;
}

// @public
export class PeriodDataUnit extends BasicUnit {
    constructor(kernel: Kernel, quoteDataUnit: QuoteDataUnit);
    // (undocumented)
    data: Record<string, IPeriod[]>;
    // (undocumented)
    dump(): {};
    // (undocumented)
    kernel: Kernel;
    periodUpdated$: Observable<IPeriod>;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    updatePeriod(period: IPeriod): void;
}

// @public (undocumented)
export class PeriodMetricsUnit extends BasicUnit {
    constructor(kernel: Kernel, periodDataUnit: PeriodDataUnit);
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
}

// @public
export class PortfolioSimulatorUnit extends BasicUnit {
    constructor(kernel: Kernel, coefficient_fn_str: string, periodDataUnit: PeriodDataUnit, productDataUnit: ProductDataUnit, mapAccountInfoToUnits: Record<string, {
        accountInfoUnit: AccountSimulatorUnit;
        accountPerformanceUnit: AccountPerformanceUnit;
        originAccountInfoUnit: AccountSimulatorUnit;
        originAccountPerformanceUnit: AccountPerformanceUnit;
        historyOrderUnit: HistoryOrderUnit;
    }>, targetAccountInfoUnit: AccountSimulatorUnit, targetAccountPerformanceUnit: AccountPerformanceUnit, targetOrderMatchingUnit: OrderMatchingUnit);
    // (undocumented)
    coefficient_fn_str: string;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    mapAccountInfoToUnits: Record<string, {
        accountInfoUnit: AccountSimulatorUnit;
        accountPerformanceUnit: AccountPerformanceUnit;
        originAccountInfoUnit: AccountSimulatorUnit;
        originAccountPerformanceUnit: AccountPerformanceUnit;
        historyOrderUnit: HistoryOrderUnit;
    }>;
    // (undocumented)
    onEvent(): void;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    statistics: IPortfolioStatistics[];
    // (undocumented)
    targetAccountInfoUnit: AccountSimulatorUnit;
    // (undocumented)
    targetAccountPerformanceUnit: AccountPerformanceUnit;
    // (undocumented)
    targetOrderMatchingUnit: OrderMatchingUnit;
}

// @public
export class ProductDataUnit extends BasicUnit {
    // (undocumented)
    dump(): {
        mapProductIdToProduct: Record<string, Record<string, IProduct>>;
    };
    // (undocumented)
    getProduct(datasource_id: string, product_id: string): IProduct | undefined;
    // (undocumented)
    listProducts(): IProduct[];
    // (undocumented)
    onInit(): void | Promise<void>;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    updateProduct(product: IProduct): void;
}

// @public
export class ProductLoadingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, productDataUnit: ProductDataUnit, options?: {} | undefined);
    // (undocumented)
    dump(): {
        productTasks: {
            datasource_id: string;
            product_id: string;
        }[];
    };
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onInit(): Promise<void>;
    // (undocumented)
    options?: {} | undefined;
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    productTasks: {
        datasource_id: string;
        product_id: string;
    }[];
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    terminal: Terminal;
}

// @public
export class QuoteDataUnit extends BasicUnit {
    dirtyProductIds: Set<string>;
    // (undocumented)
    dump(): {
        mapProductIdToQuote: Record<string, Record<string, IQuote>>;
        mapDatasourceIdMapProductIdToAccountIds: Record<string, Record<string, Set<string>>>;
    };
    // Warning: (ae-forgotten-export) The symbol "IQuote" needs to be exported by the entry point index.d.ts
    //
    // (undocumented)
    getQuote(datasource_id: string, product_id: string): IQuote | undefined;
    // (undocumented)
    listQuotes(): IQuote[];
    // (undocumented)
    onInit(): void | Promise<void>;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    updateQuote(datasource_id: string, product_id: string, ask: number, bid: number): void;
}

// @public (undocumented)
export class QuoteMetricsUnit extends BasicUnit {
    constructor(kernel: Kernel, quoteDataUnit: QuoteDataUnit);
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
}

// @public
export class RealtimePeriodLoadingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, productDataUnit: ProductDataUnit, periodDataUnit: PeriodDataUnit);
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): Promise<void>;
    // (undocumented)
    periodDataUnit: PeriodDataUnit;
    // (undocumented)
    periodTasks: {
        datasource_id: string;
        product_id: string;
        duration: string;
    }[];
    // (undocumented)
    productDataUnit: ProductDataUnit;
    // (undocumented)
    terminal: Terminal;
}

// @public
export class RealtimeTickLoadingUnit extends BasicUnit {
    constructor(kernel: Kernel, terminal: Terminal, quoteDataUnit: QuoteDataUnit, tickDataUnit: TickDataUnit);
    // (undocumented)
    addTickTask(datasource_id: string, product_id: string, account_id?: string): void;
    // (undocumented)
    kernel: Kernel;
    // (undocumented)
    onDispose(): void | Promise<void>;
    // (undocumented)
    onEvent(): void | Promise<void>;
    // (undocumented)
    onInit(): Promise<void>;
    // (undocumented)
    quoteDataUnit: QuoteDataUnit;
    // (undocumented)
    terminal: Terminal;
    // (undocumented)
    tickDataUnit: TickDataUnit;
}

// @public
export class Series extends Array<number> {
    // (undocumented)
    get currentIndex(): number;
    // (undocumented)
    get currentValue(): number;
    findParentWard(predicate: (series: Series) => any): Series | undefined;
    name: string | undefined;
    parent: Series | undefined;
    // (undocumented)
    get previousIndex(): number;
    // (undocumented)
    get previousValue(): number;
    resolveRoot(): Series;
    resolveValue(tagName: string): any;
    series_id: string;
    tags: Record<string, any>;
}

// @public
export class SeriesDataUnit extends BasicUnit {
    // (undocumented)
    dump(): {
        series: Series[];
    };
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    series: Series[];
}

// @public
export class TerminateUnit extends BasicUnit {
    // (undocumented)
    onInit(): void;
}

// @public
export class TickDataUnit extends BasicUnit {
    // (undocumented)
    dump(): {
        tickMap: Record<string, Record<string, ITick>>;
    };
    // (undocumented)
    getTick(datasource_id: string, product_id: string): ITick | undefined;
    // (undocumented)
    restore(state: any): void;
    // (undocumented)
    setTick(tick: ITick): void;
    // (undocumented)
    tickUpdated$: Subject<ITick>;
}

// Warnings were encountered during analysis:
//
// src/units/OrderMatchingUnit.ts:261:11 - (ae-forgotten-export) The symbol "IMatchingRange" needs to be exported by the entry point index.d.ts

// (No @packageDocumentation comment for this package)

```
