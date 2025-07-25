## API Report File for "@yuants/data-model"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { decodePath } from '@yuants/utils';
import { encodePath } from '@yuants/utils';
import { formatTime } from '@yuants/utils';
import { Observable } from 'rxjs';
import { UUID } from '@yuants/utils';

// @public (undocumented)
export const createEmptyAccountInfo: (account_id: string, currency: string, leverage?: number, initial_balance?: number) => IAccountInfo;

export { decodePath }

export { encodePath }

export { formatTime }

// @public
export interface IAccountCompositionRelation {
    // (undocumented)
    hide_positions?: boolean;
    // (undocumented)
    multiple: number;
    // (undocumented)
    source_account_id: string;
    // (undocumented)
    target_account_id: string;
}

// @public
export interface IAccountInfo {
    account_id: string;
    currencies: IAccountMoney[];
    money: IAccountMoney;
    orders: IOrder[];
    positions: IPosition[];
    updated_at: number;
}

// @public
export interface IAccountMoney {
    balance: number;
    currency: string;
    equity: number;
    free: number;
    leverage?: number;
    profit: number;
    used: number;
}

// @public
export interface IOrder {
    account_id: string;
    comment?: string;
    filled_at?: number;
    inferred_base_currency_price?: number;
    order_direction?: string;
    order_id?: string;
    order_status?: string;
    order_type?: string;
    position_id?: string;
    price?: number;
    product_id: string;
    profit_correction?: number;
    real_profit?: number;
    // @deprecated
    stop_loss_price?: number;
    submit_at?: number;
    // @deprecated
    take_profit_price?: number;
    traded_price?: number;
    traded_volume?: number;
    volume: number;
}

// @public
export interface IPeriod {
    close: number;
    datasource_id: string;
    duration?: string;
    high: number;
    low: number;
    open: number;
    open_interest?: number;
    // @deprecated
    period_in_sec: number;
    product_id: string;
    spread?: number;
    start_at?: number;
    // @deprecated
    timestamp_in_us: number;
    volume: number;
}

// @public
export interface IPosition {
    account_id?: string;
    closable_price: number;
    comment?: string;
    created_at?: number;
    datasource_id?: string;
    direction?: string;
    floating_profit: number;
    free_volume: number;
    interest_to_settle?: number;
    margin?: number;
    position_id: string;
    position_price: number;
    product_id: string;
    realized_pnl?: number;
    settlement_scheduled_at?: number;
    total_closed_volume?: number;
    total_opened_volume?: number;
    updated_at?: number;
    valuation: number;
    volume: number;
}

// @alpha
export interface IStandardOrder {
    account_id: string;
    amount: string;
    amount_type: 'BASE' | 'QUOTE';
    broker_id?: string;
    broker_priority_fee?: string;
    cancel_at?: string;
    direction: 'BUY' | 'SELL';
    execution_price?: string;
    maker_only?: boolean;
    max_broker_execution_fee?: string;
    max_trigger_amount?: string;
    max_trigger_times?: string;
    min_execution_amount?: string;
    order_downstream_id?: string;
    order_id: string;
    order_upstream_id?: string;
    product_id: string;
    trigger_price?: string;
}

// @public
export interface ITick {
    ask?: number;
    bid?: number;
    datasource_id: string;
    interest_rate_for_long?: number;
    interest_rate_for_short?: number;
    open_interest?: number;
    price?: number;
    product_id: string;
    settlement_scheduled_at?: number;
    spread?: number;
    updated_at: number;
    volume?: number;
}

// @public (undocumented)
export interface ITradeCopierTradeConfig {
    // (undocumented)
    account_id: string;
    // (undocumented)
    id?: string;
    // (undocumented)
    max_volume_per_order: number;
    // (undocumented)
    product_id: string;
}

// @public (undocumented)
export interface ITradeCopyRelation {
    // (undocumented)
    disabled?: boolean;
    exclusive_comment_pattern?: string;
    // (undocumented)
    id?: string;
    // (undocumented)
    multiple: number;
    // (undocumented)
    source_account_id: string;
    // (undocumented)
    source_product_id: string;
    // (undocumented)
    target_account_id: string;
    // (undocumented)
    target_product_id: string;
}

// @public
export const mergeAccountInfoPositions: (info: IAccountInfo) => Observable<IAccountInfo>;

export { UUID }

```
