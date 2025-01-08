export interface ITQResponse {
  aid: string;
  data: ITQDataElement[];
}

export interface ITQDataElement {
  klines?: { [productId: string]: { [periodInNs: string]: ITQKlineState } };
  ticks?: { [productId: string]: ITQTickData };
  account_id?: string;
  charts?: { [chartId: string]: ITQChart };
  ins_list?: string;
  mdhis_more_data?: boolean;
}

export interface ITQChart {
  left_id: number;
  more_data: boolean;
  ready: boolean;
  right_id: number;
  state: ITQChartState;
}

export interface ITQChartState {
  account_id: string;
  aid: string;
  chart_id: string;
  duration: number;
  ins_list: string;
  session_id: string;
  view_width: number;
}

export interface ITQKlineState {
  data?: { [key: string]: ITQKline };
  last_id?: number;
  market_time_length?: number;
  trading_day_end_id?: number;
  trading_day_length?: number;
  trading_day_start_id?: number;
}

export interface ITQKline {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_oi: number;
  close_oi: number;
}

export interface ITQTickData {
  data?: { [key: string]: ITQTick };
  last_id?: number;
}

export interface ITQTick {
  datetime: number;
  last_price: number;
  average: number;
  highest: number;
  lowest: number;
  open_interest: number;
  volume: number;
  amount: number;
}
