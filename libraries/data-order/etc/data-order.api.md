## API Report File for "@yuants/data-order"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

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

// (No @packageDocumentation comment for this package)

```
