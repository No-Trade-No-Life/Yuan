import {
  decodeBase58,
  encodeHex,
  formatTime,
  fromPrivateKey,
  HmacSHA256,
  scopeError,
  signMessageByEd25519,
} from '@yuants/utils';

export interface ICredential {
  /**
   * ED25519 Private KEY (base58)
   */
  private_key: string;
}

const BASE_URL = 'https://surfv2-api.surf.one';

export const privateRequest = async (
  credential: ICredential,
  method: string,
  path: string,
  params: any = {},
) => {
  const url = new URL(BASE_URL);
  url.pathname = path;

  if (method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, `${value}`);
      }
    }
  }

  const publicKey = fromPrivateKey(credential.private_key).public_key;
  const publicKeyBinary = decodeBase58(publicKey);
  const publicKeyHex = encodeHex(publicKeyBinary);

  const privateKeyBinary = decodeBase58(credential.private_key);

  const headers: Record<string, string> = {};

  const timestamp = Math.floor(Date.now() / 1000).toString();

  // 除了 host 之外的所有内容
  const _path = url.pathname + url.search;

  const data =
    `method=${method}&path=${_path}&timestamp=${timestamp}&access-key=${publicKeyHex}` +
    (method === 'POST' ? `&body=${JSON.stringify(params)}` : '');
  const hashData = await HmacSHA256(new TextEncoder().encode(data), publicKeyBinary);

  const signature = signMessageByEd25519(hashData, privateKeyBinary);
  const signatureHex = encodeHex(signature);

  headers['API-KEY'] = publicKeyHex;
  headers['TIMESTAMP'] = timestamp;
  headers['SIGN'] = signatureHex;
  headers['LANG'] = 'zh-cn';

  const body = method === 'POST' ? JSON.stringify(params) : undefined;
  const response = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  const text = await response.text();

  console.info(
    formatTime(Date.now()),
    method,
    url.toString(),
    `response = ${text}, requestBody = ${body}, headers = ${JSON.stringify(headers)}`,
  );

  return scopeError('TurboAPIError', { status: response.status, statusText: response.statusText, text }, () =>
    JSON.parse(text),
  );
};

export const createPrivateApi =
  <T, K>(method: string, path: string) =>
  (credential: ICredential, params: T): Promise<K> =>
    privateRequest(credential, method, path, params);

/**
 * 获取账户信息
 */
export const getAccountInfo = createPrivateApi<
  void,
  {
    errno: string;
    msg: string;
    data: {
      account_id: string;
      referral_code: string;
      email: string;
      sign_up_type: string;
      address: string;
      user_name: string;
      agr_state: boolean;
      new_user_guide: boolean;
      can_survey: boolean;
      is_referrer: boolean;
      rebate_agent_level: number;
      is_rebate_admin: boolean;
      is_rebate_login: boolean;
      x_related: {
        nick_name: string;
        profile_url: string;
      };
      svm_account: string;
      svm_approve_hash: string;
      svm_approve_state: boolean;
      svm_approve_stage: number;
      voucher_pro_state: boolean;
      stock_code: string;
    };
  }
>('GET', '/account/info');

/**
 * 获取账户资产
 */
export const getAccountAssets = createPrivateApi<
  { fill_coin_sub_info?: string },
  {
    errno: number;
    msg: string;
    data: {
      list: Array<{
        coin_address: string;
        coin_code: string;
        available_balance: string;
        freeze_balance: string;
        max_withdraw_amount: string;
        simulation_balance: string;
        un_pnl: string;
        wd_frz: string;
        internal_wd_freeze: string;
        cro_un_pnl: string;
        isol_un_pnl: string;
        isol_frz: string;
        coin_name: string;
        coin_sub_info?: {
          price: string;
          logo: string;
        };
        type: number;
      }>;
    };
  }
>('GET', '/account/assets');

/**
 * 提交订单
 */
export const submitOrder = createPrivateApi<
  {
    request_id: number;
    pair_id: string;
    pool_id: number;
    coin_code: string;
    order_type: 'limit' | 'market' | 'stop_limit' | 'stop_market';
    order_way: 1 | 2 | 3 | 4; // 1:开多 2:平空 3:开空 4:平多
    margin_type: 1 | 2; // 1:逐仓 2:全仓
    leverage: number;
    vol?: number; // 交易数量
    size?: string; // 交易数量
    position_mode: 1 | 2 | 3; // 1:单向 2:双向 3:原子
    time_in_force: 'GTC' | 'IOC' | 'FOK';
    fee_mode: 1 | 2; // 1:固定 2:利润分层
    order_mode: 1 | 2; // 1:普通 2:条件
    price?: string; // 限价单价格
    position_id?: string; // 平仓时需要
  },
  {
    errno: string;
    msg: string;
    data: {
      request_id: string;
      account_id: string;
      order: {
        id: string;
        pool_id: number;
        pair_id: string;
        order_type: string;
        order_status: string;
      };
    };
  }
>('POST', '/account/order/submit');

/**
 * 修改订单
 */
export const remendOrder = createPrivateApi<
  {
    position_id: string;
    price?: string;
    vol?: string;
    tp_order?: {
      order_type: string;
      close_pos: boolean;
      stop_price: string;
    };
    sl_order?: {
      order_type: string;
      close_pos: boolean;
      stop_price: string;
    };
  },
  {
    errno: string;
    msg: string;
    data: {
      request_id: string;
      account_id: string;
    };
  }
>('POST', '/account/order/remend');

/**
 * 取消订单
 */
export const cancelOrder = createPrivateApi<
  {
    pair_id: string;
    order_id: string;
    pool_id: number;
  },
  {
    errno: string;
    msg: string;
    data: any;
  }
>('POST', '/account/order/cancel');

/**
 * 快速订单 (反向)
 */
export const quickOrder = createPrivateApi<
  {
    position_id: string;
    quick_type: 'Reverse';
  },
  {
    errno: string;
    msg: string;
    data: any;
  }
>('POST', '/account/order/quick');

/**
 * 保证金转账
 */
export const transferMargin = createPrivateApi<
  {
    margin: string;
    position_id: string;
  },
  {
    errno: string;
    msg: string;
    data: any;
  }
>('POST', '/account/order/transfer');

/**
 * 模拟保证金转账
 */
export const simulateTransferMargin = createPrivateApi<
  {
    position_id: string;
    margin: string;
  },
  {
    errno: string;
    msg: string;
    data: {
      max_add_margin: string;
      min_remove_margin: string;
      liq_price: string;
      leverage: string;
    };
  }
>('GET', '/account/order/transfer/simulate');

/**
 * 获取交易配置
 */
export const getOrderConfigs = createPrivateApi<
  void,
  {
    errno: string;
    msg: string;
    data: {
      max_add_margin: string;
      min_remove_margin: string;
    };
  }
>('GET', '/account/order/configs');

/**
 * 获取订单列表
 */
export const getOrderList = createPrivateApi<
  {
    page_num?: number;
    page_size?: number;
    status?: string; // All, Pending, Filled, Cancelled, Rejected
  },
  {
    errno: string;
    msg: string;
    data: {
      page_size: number;
      page_num: number;
      count: number;
      page_count: number;
      data: Array<{
        id: string;
        pool_id: number;
        pair_id: string;
        coin_code: string;
        coin_name: string;
        price: string;
        size: string;
        vol: string;
        leverage: string;
        order_type: string;
        order_way: number;
        margin_type: number;
        dual_side: boolean;
        fee_mode: number;
        pos_mode: number;
        done_vol: string;
        deal_price: string;
        done_amount: string;
        done_size: string;
        done_pnl: string;
        biz_code: number;
        order_status: string;
        view_type: string;
        position_id: string;
        close_pos: boolean;
        tp_price: string;
        sl_price: string;
        stop_price: string;
        updated_at: string;
        created_at: string;
      }>;
    };
  }
>('GET', '/account/order/list');

/**
 * 获取交易列表
 */
export const getTradeList = createPrivateApi<
  {
    page_num?: number;
    page_size?: number;
  },
  {
    errno: string;
    msg: string;
    data: {
      page_size: number;
      page_num: number;
      count: number;
      page_count: number;
      data: Array<{
        id: string;
        pool_id: number;
        pair_id: string;
        symbol: string;
        pair_logo: string;
        coin_code: string;
        coin_name: string;
        coin_logo: string;
        account_id: string;
        leverage: string;
        fee_mode: number;
        order_way: number;
        order_mode: number;
        view_type: string;
        entry_price: string;
        maker_coin: string;
        maker_coin_name: string;
        maker_coin_logo: string;
        done_price: string;
        done_vol: string;
        done_vol_usd: string;
        done_amount: string;
        done_size: string;
        share_pnl: string;
        done_pnl: string;
        done_pnl_usd: string;
        done_fee: string;
        funding_fee: string;
        coin_price: string;
        fee_saved_usd: string;
        liq_price: string;
        created_at: string;
        margin_type: number;
        order_price: string;
        roe: string;
        x_related: {
          nick_name: string;
          profile_url: string;
        };
      }>;
    };
  }
>('GET', '/account/trade/list');

/**
 * 获取交易现金列表
 */
export const getCashTradeList = createPrivateApi<
  {
    page_num?: number;
    page_size?: number;
  },
  {
    errno: string;
    msg: string;
    data: {
      page_size: number;
      page_num: number;
      count: number;
      page_count: number;
      data: Array<{
        id: string;
        pool_id: number;
        pair_id: string;
        order_way: number;
        order_mode: number;
        symbol: string;
        pair_logo: string;
        share_rate: string;
        pair_profit_size: string;
        margin_type: number;
        volume: string;
        size: string;
        leverage: string;
        collateral_coin: string;
        entry_price: string;
        done_pnl: string;
        share_pnl: string;
        fee_mode: number;
        account_id: string;
        action: number;
        coin_code: string;
        coin_name: string;
        coin_logo: string;
        coin_price: string;
        amount: string;
        available_balance: string;
        created_at: string;
      }>;
    };
  }
>('GET', '/account/trade/cash/list');

/**
 * 获取持仓列表
 */
export const getPositionList = createPrivateApi<
  {
    status?: 'Holding' | 'Closed';
    page_num?: number;
    page_size?: number;
  },
  {
    errno: string;
    msg: string;
    data: {
      page_size: number;
      page_num: number;
      count: number;
      page_count: number;
      data?: Array<{
        id: string;
        pool_id: number;
        pair_id: string;
        symbol: string;
        pair_logo: string;
        coin_code: string;
        coin_name: string;
        coin_logo: string;
        side: number;
        hold_size: string;
        hold_av: string;
        fee_mode: number;
        margin_type: number;
        im: string;
        mm: string;
        em: string;
        dual_side: boolean;
        pos_mode: number;
        leverage: string;
        liq_price: string;
        tp_price: string;
        tp_size: string;
        sl_price: string;
        sl_size: string;
        unpnl: string;
        realize_pnl: string;
        acc_ff: string;
        status: number;
        updated_at: string;
        created_at: string;
        account_id: string;
        base_fee_rate: string;
        rate_multi: string;
        rate_exp: string;
        pos_multi: string;
        pnl_base_rate: string;
        max_order_size: string;
        max_slippage: string;
        buffer_rate: string;
        price_factor: string;
        hair_cut: string;
        cross_leverage?: string;
        cross_mm?: string;
        cross_unpnl?: string;
        cross_coin_unpnl?: string;
        cross_health?: string;
        frozen_vol?: string;
        isolated_available?: string;
        cross_available?: string;
        cross_risk_im?: string;
        cross_risk_mm?: string;
        cross_equity?: string;
      }>;
    };
  }
>('GET', '/account/position/list');

/**
 * 获取仓位历史
 */
export const getPositionHistory = createPrivateApi<
  {
    page_num?: number;
    page_size?: number;
  },
  {
    errno: string;
    msg: string;
    data: {
      page_size: number;
      page_num: number;
      count: number;
      page_count: number;
      data: Array<{
        id: string;
        pool_id: number;
        pair_id: string;
        symbol: string;
        pair_logo: string;
        coin_code: string;
        coin_name: string;
        coin_logo: string;
        account_id: string;
        side: number;
        fee_mode: number;
        margin_type: number;
        pos_mode: number;
        leverage: string;
        im: string;
        status: number;
        realize_pnl: string;
        realize_pnl_usd: string;
        roe: string;
        entry_price: string;
        open_max_size: string;
        exit_price: string;
        closed_size: string;
        closed_at: string;
        created_at: string;
        maker_coin: string;
        maker_coin_name: string;
        maker_coin_logo: string;
        maker_coin_pnl: string;
      }>;
    };
  }
>('GET', '/account/position/history');

/**
 * 获取交易对价格
 */
export const getPairPrice = createPrivateApi<
  {
    spot_token_key: string;
  },
  {
    errno: string;
    msg: string;
    data: {
      price: string;
      tm: number;
    };
  }
>('GET', '/market/pair/price');

/**
 * 获取K线数据
 */
export const getKline = createPrivateApi<
  {
    spot_token_key: string;
    granularity: string;
    limit?: number;
    end_time?: number;
  },
  {
    errno: string;
    msg: string;
    data: Array<{
      t: number;
      o: string;
      h: string;
      l: string;
      c: string;
      g: string;
    }>;
  }
>('GET', '/market/kline');

/**
 * 获取交易对小数配置
 */
export const getDecimalConfig = createPrivateApi<
  void,
  {
    errno: string;
    msg: string;
    data: Array<{
      coin_code: string;
      balance_decimal: number;
      price_decimal: number;
      coin_name: string;
    }>;
  }
>('GET', '/market/pair/decimal/config');

/**
 * 获取抵押品列表
 */
export const getCollateralList = createPrivateApi<
  {
    pair_id: number;
  },
  {
    errno: string;
    msg: string;
    data: Array<{
      id: number;
      pool_id: number;
      coin_code: string;
      coin_name: string;
      collateral_logo: string;
      balance: string;
      hair_cut: string;
      trade_pair_count: number;
      max_hold_volume: string;
      trader_max_hold_volume: string;
    }>;
  }
>('GET', '/pool/collateral/list');

/**
 * 获取交易配置 (Public)
 */
export const getTradingConfigs = createPrivateApi<
  void,
  {
    errno: string;
    msg: string;
    data: {
      liquidate_configs: any;
      isolated_configs: any;
      cross_configs: Array<{
        imr: string;
        mmr: string;
        min_size: string;
        max_size: string;
      }>;
      is_shareprofit_active: boolean;
      shareprofit_configs: {
        start_time: string;
        end_time: string;
        pair_configs: Array<{
          pair_id: number;
          threshold: string;
          default_threshold: string;
        }>;
      };
    };
  }
>('GET', '/public/trading/configs');

/**
 * 获取交易对分享费用 (Public)
 */
export const getPairShareFees = createPrivateApi<
  {
    pair_id: string;
    order_way: number;
    price: string;
    vol: string;
    leverage: number;
  },
  {
    errno: string;
    msg: string;
    data: {
      list: Array<{
        price: string;
        roi: string;
        unpnl: string;
        share_pnl: string;
        fee_rate: string;
      }>;
    };
  }
>('GET', '/public/pair/share/fees');
