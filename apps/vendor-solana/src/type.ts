export interface IGMGN {
  code: number;
  msg: string;
  data: {
    holdings: {
      address: string;
      token_address: string;
      symbol: string;
      name: string;
      decimals: number;
      logo: string;
      balance: string;
      usd_value: number;
      realized_profit_30d: number;
      realized_profit: number;
      realized_pnl: number | null;
      realized_pnl_30d: number;
      unrealized_profit: number;
      unrealized_pnl: number;
      total_profit: number;
      total_profit_pnl: number;
      avg_cost: number;
      avg_sold: number | null;
      buy_30d: number;
      sell_30d: number;
      sells: number;
      price: number;
      cost: number;
      position_percent: number;
      last_active_timestamp: number;
      history_sold_income: number;
      history_bought_cost: number;
      price_change_5m: number;
      price_change_1h: number;
      price_change_6h: number;
      price_change_24h: number;
      is_following: boolean;
      is_show_alert: boolean;
      is_honeypot: null;
    }[];
    next: null;
  };
}
