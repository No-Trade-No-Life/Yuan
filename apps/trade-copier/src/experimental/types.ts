import { IAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { ITradeCopierStrategyBase } from '../interface';

/**
 * 策略动作类型
 */
export type StrategyAction = {
  type: 'SubmitOrder' | 'CancelOrder';
  payload: IOrder;
};

/**
 * 策略上下文
 */
export interface StrategyContext {
  // 账户信息
  accountId: string;
  productKey: string;

  // 实际账户信息
  actualAccountInfo: IAccountInfo;
  // 预期账户信息
  expectedAccountInfo: IAccountInfo;

  // 产品信息
  product: IProduct;

  // 行情数据
  quote: IQuote;

  // 挂单信息
  pendingOrders: IOrder[];

  // 策略配置
  strategy: ITradeCopierStrategyBase;
}

/**
 * 策略函数签名
 * 策略只需要返回目标订单列表，由外部统一协调成动作
 */
export type StrategyFunction = (context: StrategyContext) => IOrder[];
