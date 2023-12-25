import { IAccountInfo, IOrder, IPeriod, IProduct } from '@yuants/protocol';
import { Kernel } from '../kernel';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  HistoryOrderUnit,
  PeriodDataUnit,
  ProductDataUnit,
  QuoteDataUnit,
  TerminateUnit,
} from '../units';

/**
 * 内建场景：订单合并回放场景
 * @public
 */
export const OrderMergeReplayScene = (
  kernel: Kernel,
  init_account_info: IAccountInfo,
  periods: IPeriod[],
  orders: IOrder[],
  products: IProduct[],
) => {
  // 开始合并账户回放

  const quoteDataUnit = new QuoteDataUnit(kernel);
  const productDataUnit = new ProductDataUnit(kernel);
  {
    for (const product of products) {
      productDataUnit.mapProductIdToProduct[product.product_id] = product;
    }
  }
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  {
    const mapEventIdToPeriod = new Map<number, IPeriod>();
    for (const period of periods) {
      const id = kernel.alloc(period.timestamp_in_us / 1000);
      mapEventIdToPeriod.set(id, period);
    }
    new BasicUnit(kernel).onEvent = () => {
      const period = mapEventIdToPeriod.get(kernel.currentEventId);
      if (period) {
        periodDataUnit.updatePeriod(period);
        mapEventIdToPeriod.delete(kernel.currentEventId);
      }
    };
  }
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  {
    const mapEventIdToOrder = new Map<number, IOrder>();
    for (const order of orders) {
      const id = kernel.alloc(order.timestamp_in_us! / 1000);
      mapEventIdToOrder.set(id, order);
    }
    new BasicUnit(kernel).onEvent = () => {
      const order = mapEventIdToOrder.get(kernel.currentEventId);
      if (order) {
        historyOrderUnit.updateOrder(order);
        mapEventIdToOrder.delete(kernel.currentEventId);
      }
    };
  }

  const accountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    historyOrderUnit,
    init_account_info,
  );
  const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);
  new TerminateUnit(kernel);
  return { kernel, accountInfoUnit, accountPerformanceUnit, productDataUnit, quoteDataUnit, periodDataUnit };
};
