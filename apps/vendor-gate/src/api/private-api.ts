import type { GateParams, HttpMethod, IGateCredential } from './http-client';
import { requestPrivate } from './http-client';

export type ICredential = IGateCredential;

const callPrivate = <TResponse>(
  credential: ICredential,
  method: HttpMethod,
  path: string,
  params?: GateParams,
) => requestPrivate<TResponse>(credential, method, path, params);

/**
 * 获取用户账户信息
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF
 */
export const getAccountDetail = (
  credential: ICredential,
): Promise<{
  user_id: number;
  ip_whitelist: string[];
  currency_pairs: string[];
  key: {
    mode: number;
  };
  tier: number;
}> => callPrivate(credential, 'GET', '/account/detail');

/**
 * 获取统一账户信息
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%BB%9F%E4%B8%80%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF
 */
export const getUnifiedAccounts = (
  credential: ICredential,
  params?: { currency?: string },
): Promise<{
  user_id: string;
  refresh_time: number;
  locket: boolean;
  balances: Record<
    string,
    {
      available: string;
      freeze: string;
      borrowed: string;
      negative_liab: string;
      futures_pos_liab: string;
      equity: string;
      total_freeze: string;
      total_liab: string;
      spot_in_use: string;
      cross_balance: string;
      iso_balance: string;
      funding: string;
    }
  >;
  total: string;
  borrowed: string;
  total_initial_margin: string;
  total_margin_balance: string;
  total_maintenance_margin: string;
  total_initial_margin_rate: string;
  total_maintenance_margin_rate: string;
  total_avail_margin: string;
  unified_account_total: string;
  unified_account_total_liab: string;
  unified_account_total_equity: string;
  leverage: string;
  spot_order_loss: string;
  spot_hedge: boolean;
}> => callPrivate(credential, 'GET', '/unified/accounts', params);

/**
 * 获取用户仓位列表
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E4%BB%93%E4%BD%8D%E5%88%97%E8%A1%A8
 */
export const getFuturePositions = (
  credential: ICredential,
  quote_currency: string,
  params?: { holding?: boolean; limit?: number; offset?: number },
): Promise<
  {
    user: number;
    contract: string;
    size: number;
    leverage: string;
    risk_limit: string;
    leverage_max: string;
    maintenance_rate: string;
    value: string;
    margin: string;
    entry_price: string;
    mark_price: string;
    unrealised_pnl: string;
    realised_pnl: string;
    mode: string;
    liq_price: string;
  }[]
> => callPrivate(credential, 'GET', `/futures/${quote_currency}/positions`, params);

/**
 * 查询合约订单列表
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%90%88%E7%BA%A6%E8%AE%A2%E5%8D%95%E5%88%97%E8%A1%A8
 */
export const getFuturesOrders = (
  credential: ICredential,
  settle: string,
  params: {
    contract?: string;
    status: string;
    limit?: number;
    offset?: number;
    last_id?: number;
  },
): Promise<
  {
    id: string;
    contract: string;
    create_time: number;
    size: number;
    price: string;
    is_close: boolean;
    fill_price: string;
    left?: number;
    status?: string;
    text: string;
  }[]
> => callPrivate(credential, 'GET', `/futures/${settle}/orders`, params);

/**
 * 获取合约账号
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%90%88%E7%BA%A6%E8%B4%A6%E5%8F%B7
 */
export const getFuturesAccounts = (
  credential: ICredential,
  settle: string,
): Promise<{
  user: number;
  currency: string;
  total: string;
  unrealised_pnl: string;
  position_margin: string;
  order_margin: string;
  available: string;
  point: string;
  bonus: string;
  in_dual_mode: boolean;
  enable_evolved_classic: boolean;
  history: {
    dnw: string;
    pnl: string;
    fee: string;
    refr: string;
    fund: string;
    point_dnw: string;
    point_fee: string;
    point_refr: string;
    bonus_dnw: string;
    bonus_offset: string;
  };
}> => callPrivate(credential, 'GET', `/futures/${settle}/accounts`);

/**
 * 合约交易下单
 *
 * 下单时指定的是合约张数 size ，而非币的数量，每一张合约对应的币的数量是合约详情接口里返回的 quanto_multiplier
 *
 * 0 成交的订单在撤单 10 分钟之后无法再获取到，会提到订单不存在
 *
 * 设置 reduce_only 为 true 可以防止在减仓的时候穿仓
 *
 * 单仓模式下，如果需要平仓，需要设置 size 为 0 ，close 为 true
 *
 * 双仓模式下，平仓需要使用 auto_size 来设置平仓方向，并同时设置 reduce_only 为 true，size 为 0
 *
 * 设置 stp_act 决定使用限制用户自成交的策略，详细用法参考body参数stp_act
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%90%88%E7%BA%A6%E4%BA%A4%E6%98%93%E4%B8%8B%E5%8D%95
 */
export const postFutureOrders = (
  credential: ICredential,
  settle: string,
  params: {
    contract: string;
    size: number;
    iceberg?: number;
    price?: string;
    close?: boolean;
    reduce_only?: boolean;
    tif?: string;
    text?: string;
    auto_size?: string;
    stp_act?: string;
  },
): Promise<{
  label?: string;
  message?: string;
  detail?: string;
  id: number;
  user: number;
  contract: string;
  create_time: number;
  size: number;
  iceberg: number;
  left: number;
  price: string;
  fill_price: string;
  mkfr: string;
  tkfr: string;
  tif: string;
  refu: number;
  is_reduce_only: boolean;
  is_close: boolean;
  is_liq: boolean;
  text: string;
  status: string;
  finish_time: number;
  finish_as: string;
  stp_id: number;
  stp_act: string;
  amend_text: string;
}> => callPrivate(credential, 'POST', `/futures/${settle}/orders`, params);

/**
 * 撤销单个订单
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%92%A4%E9%94%80%E5%8D%95%E4%B8%AA%E8%AE%A2%E5%8D%95-2
 */
export const deleteFutureOrders = (credential: ICredential, settle: string, order_id: string): Promise<{}> =>
  callPrivate(credential, 'DELETE', `/futures/${settle}/orders/${order_id}`);

/**
 * 提现
 *
 * POST /withdrawals
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%8F%90%E7%8E%B0
 */
export const postWithdrawals = (
  credential: ICredential,
  params: {
    withdraw_order_id?: string;
    amount: string;
    currency: string;
    address?: string;
    memo?: string;
    chain: string;
  },
): Promise<{
  id: string;
  txid: string;
  withdraw_order_id: string;
  timestamp: number;
  amount: string;
  currency: string;
  address: string;
  memo: string;
  status: string;
  chain: string;
}> => callPrivate(credential, 'POST', '/withdrawals', params);

/**
 * 获取币种充值地址
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%B8%81%E7%A7%8D%E5%85%85%E5%80%BC%E5%9C%B0%E5%9D%80
 */
export const getDepositAddress = (
  credential: ICredential,
  params: {
    currency: string;
  },
): Promise<{
  currency: string;
  address: string;
  multichain_addresses: {
    chain: string;
    address: string;
    payment_id: string;
    payment_name: string;
    obtain_failed: boolean;
  }[];
}> => callPrivate(credential, 'GET', '/wallet/deposit_address', params);

/**
 * 创建新的子账户
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%88%9B%E5%BB%BA%E6%96%B0%E7%9A%84%E5%AD%90%E8%B4%A6%E6%88%B7
 */
export const getSubAccountList = (
  credential: ICredential,
  params?: {
    type?: string;
  },
): Promise<
  {
    remark: string;
    login_name: string;
    password: string;
    email: string;
    state: number;
    type: number;
    user_id: number;
    create_time: number;
  }[]
> => callPrivate(credential, 'GET', '/sub_accounts', params);

/**
 * 获取充值记录
 *
 * 记录查询时间范围不允许超过 30 天
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%85%85%E5%80%BC%E8%AE%B0%E5%BD%95
 */
export const getDepositHistory = (
  credential: ICredential,
  params?: {
    currency?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  },
): Promise<
  {
    id: string;
    txid: string;
    withdraw_order_id: string;
    timestamp: number;
    amount: string;
    currency: string;
    address: string;
    memo: string;
    status: string;
    chain: string;
  }[]
> => callPrivate(credential, 'GET', '/wallet/deposits', params);

/**
 * 获取提现记录
 *
 * 记录查询时间范围不允许超过 30 天
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%B8%81%E7%A7%8D%E5%85%85%E5%80%BC%E5%9C%B0%E5%9D%80
 */
export const getWithdrawalHistory = (
  credential: ICredential,
  params?: {
    currency?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  },
): Promise<
  {
    id: string;
    txid: string;
    withdraw_order_id: string;
    timestamp: number;
    amount: string;
    currency: string;
    address: string;
    memo: string;
    status: string;
    chain: string;
  }[]
> => callPrivate(credential, 'GET', '/wallet/withdrawals', params);

/**
 * 获取现货交易账户列表
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%8E%B0%E8%B4%A7%E4%BA%A4%E6%98%93%E8%B4%A6%E6%88%B7%E5%88%97%E8%A1%A8
 */
export const getSpotAccounts = (
  credential: ICredential,
  params?: {
    currency?: string;
  },
): Promise<
  {
    currency: string;
    available: string;
    locked: string;
    update_id: string;
  }[]
> => callPrivate(credential, 'GET', '/spot/accounts', params);

/**
 * 交易账户互转
 *
 * POST /wallet/transfers
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E4%BA%A4%E6%98%93%E8%B4%A6%E6%88%B7%E4%BA%92%E8%BD%AC
 */
export const postWalletTransfer = (
  credential: ICredential,
  params: {
    currency: string;
    from: string;
    to: string;
    amount: string;
    currency_pair?: string;
    settle?: string;
  },
): Promise<{
  tx_id: string;
}> => callPrivate(credential, 'POST', '/wallet/transfers', params);

/**
 * 获取统一账户最多可转出
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E7%BB%9F%E4%B8%80%E8%B4%A6%E6%88%B7%E6%9C%80%E5%A4%9A%E5%8F%AF%E8%BD%AC%E5%87%BA
 */
export const getUnifiedTransferable = (
  credential: ICredential,
  params: {
    currency: string;
  },
): Promise<{
  currency: string;
  amount: string;
}> => callPrivate(credential, 'GET', `/unified/transferable`, params);

/**
 * 查询合约账户变更历史
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%90%88%E7%BA%A6%E8%B4%A6%E6%88%B7%E5%8F%98%E6%9B%B4%E5%8E%86%E5%8F%B2
 */
export const getFutureAccountsBook = (
  credential: ICredential,
  params: {
    settle: string;
    contract?: string;
    limit?: number;
    offset?: number;
    from?: number;
    to?: number;
    type?: string; //  | 'dnw' | 'pnl' | 'fee' | 'refr' | 'fund' | 'point_dnw' | 'point_fee' | 'point_refr' | 'bonus_offset'
  },
): Promise<
  {
    time: number;
    change: string;
    balance: string;
    text: string;
    type: string;
    contract: string;
    trade_id: string;
    id: string;
  }[]
> => callPrivate(credential, 'GET', `/futures/${params.settle}/account_book`, params);

/**
 * 查询个人成交记录(时间区间)
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E4%B8%AA%E4%BA%BA%E6%88%90%E4%BA%A4%E8%AE%B0%E5%BD%95-%E6%97%B6%E9%97%B4%E5%8C%BA%E9%97%B4
 */
export const getFutureAccountsTrades = (
  credential: ICredential,
  params: {
    settle: string;
    contract?: string;
    limit?: number;
    offset?: number;
    from?: number;
    to?: number;
    role?: string;
  },
): Promise<
  {
    trade_id: string;
    create_time: number;
    contract: string;
    order_id: string;
    size: string;
    price: string;
    text: string;
    fee: string;
    point_fee: string;
    role: string;
    close_size: string;
  }[]
> => callPrivate(credential, 'GET', `/futures/${params.settle}/my_trades_timerange`, params);
