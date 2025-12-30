import { IOrder } from '@yuants/data-order';
import { decodePath, formatTime, newError, roundToStep } from '@yuants/utils';
import {
  ICredential,
  getAccountAssetsMode,
  getCrossMarginLoanInfo,
  getSpotAccountBalance,
  getSwapCrossPositionInfo,
  postSpotOrder,
  postSwapOrder,
  postUnionAccountSwapOrder,
} from '../../api/private-api';
import { getSpotTick } from '../../api/public-api';
import { productCache } from '../product';
import { superMarginAccountUidCache } from '../uid';

/**
 * 处理 swap 账户订单提交
 */
async function handleUnionAccountSwapOrder(
  order: IOrder,
  credential: ICredential,
): Promise<{ order_id: string }> {
  const [, instType, contractCode] = decodePath(order.product_id);
  const params = {
    contract_code: contractCode,
    margin_mode: 'cross',
    price: order.price,
    volume: order.volume,
    position_side: 'both',
    side: order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell',
    type: order.order_type === 'MARKET' ? 'market' : 'limit',
    channel_code: process.env.BROKER_ID,
    reduce_only: order.is_close ? 1 : 0,
  };
  const result = await postUnionAccountSwapOrder(credential, params);
  console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(result), JSON.stringify(params));

  if (result.code !== 200) {
    throw newError(`HTX_SUBMIT_ORDER_FAILED`, { result });
  }
  return { order_id: result.data.order_id_str };
}

/**
 * 处理 swap 账户订单提交
 */
async function handleSwapOrder(order: IOrder, credential: ICredential): Promise<{ order_id: string }> {
  // 获取仓位信息
  const positionInfo = await getSwapCrossPositionInfo(credential);
  const mapContractCodeToRate = Object.fromEntries(
    positionInfo.data.map((v) => [v.contract_code, v.lever_rate]),
  );

  const [, instType, contractCode] = decodePath(order.product_id);
  const lever_rate = mapContractCodeToRate[contractCode] ?? 20;
  const params = {
    contract_code: contractCode,
    contract_type: 'swap',
    price: order.price,
    volume: order.volume,
    offset:
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT' ? 'open' : 'close',
    direction:
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell',
    // dynamically adjust the leverage
    lever_rate,
    order_price_type: order.order_type === 'MARKET' ? 'market' : 'limit',
    channel_code: process.env.BROKER_ID,
  };

  const result = await postSwapOrder(credential, params);
  console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(result), JSON.stringify(params));

  if (result.status !== 'ok') {
    throw newError(`HTX_SUBMIT_ORDER_FAILED`, { result });
  }
  return { order_id: result.data.order_id_str };
}

/**
 * 处理 super-margin 账户订单提交
 */
async function handleSuperMarginOrder(order: IOrder, credential: ICredential): Promise<{ order_id: string }> {
  // 获取可贷款金额
  const superMarginAccountUid = await superMarginAccountUidCache.query(JSON.stringify(credential));
  if (!superMarginAccountUid) throw new Error('Super margin account UID not found');
  const loanInfo = await getCrossMarginLoanInfo(credential);
  const usdtLoanable = loanInfo.data.find((v) => v.currency === 'usdt');
  if (!usdtLoanable) throw new Error('USDT loanable amount not found');
  const loanable = +usdtLoanable['loanable-amt'];

  const [, instType, contractCode] = decodePath(order.product_id);

  // 获取账户余额, 产品信息和价格
  const [balanceRes, theProduct, priceRes] = await Promise.all([
    getSpotAccountBalance(credential, superMarginAccountUid),
    productCache.query(order.product_id),
    getSpotTick({ symbol: contractCode }),
  ]);

  const balance = balanceRes.data.list
    .filter((v) => v.currency === 'usdt' && v.type === 'trade')
    .reduce((acc, cur) => acc + +cur.balance, 0);

  if (!theProduct) throw newError('HUOBI_SUBMIT_ORDER_PRODUCT_NOT_FOUND', { product_id: order.product_id });

  const price = priceRes.tick.close;
  const borrow_amount =
    order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT'
      ? Math.max(Math.min(loanable, order.volume * price - balance), 0)
      : undefined;

  const params = {
    symbol: contractCode,
    'account-id': '' + superMarginAccountUid,
    amount:
      '' +
      (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT'
        ? roundToStep(order.volume * price, theProduct?.volume_step!)
        : order.volume),
    'borrow-amount': '' + borrow_amount,
    type: `${
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell'
    }-${'LIMIT' === order.order_type ? 'limit' : 'market'}`,
    'trade-purpose':
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT'
        ? '1' // auto borrow
        : '2', // auto repay
    price: order.order_type === 'MARKET' ? undefined : '' + order.price,
    source: 'super-margin-api',
    'client-order-id': process.env.BROKER_ID,
  };

  const result = await postSpotOrder(credential, params);
  console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(result), JSON.stringify(params));

  if (result.success === false) {
    throw new Error(`Failed to submit super margin order: code=${result.code} message=${result.message}`);
  }

  return { order_id: result.data.orderId.toString() };
}

export const submitOrder = async (credential: ICredential, order: IOrder): Promise<{ order_id: string }> => {
  const [, instType] = decodePath(order.product_id);
  if (instType === 'SWAP') {
    const accountMode = await getAccountAssetsMode(credential);
    if (accountMode.data.asset_mode === 1) {
      return handleUnionAccountSwapOrder(order, credential);
    }
    return handleSwapOrder(order, credential);
  }
  if (instType === 'SUPER-MARGIN') {
    return handleSuperMarginOrder(order, credential);
  }
  throw newError('UNSUPPORTED_INST_TYPE', { order_type: instType });
};
