import { IAccountInfo } from '@yuants/data-account';
import { IOHLC } from '@yuants/data-ohlc';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { Kernel } from '../kernel';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  HistoryOrderUnit,
  PeriodDataUnit,
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
  periods: IOHLC[],
  orders: IOrder[],
  products: IProduct[],
) => {
  // 开始合并账户回放

  const quoteDataUnit = new QuoteDataUnit(kernel);

  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  {
    const mapEventIdToPeriod = new Map<number, IOHLC>();
    for (const period of periods) {
      const id = kernel.alloc(new Date(period.created_at).getTime());
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
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit);
  {
    const mapEventIdToOrder = new Map<number, IOrder>();
    for (const order of orders) {
      const id = kernel.alloc(order.submit_at!);
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
    quoteDataUnit,
    historyOrderUnit,
    init_account_info,
  );
  const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);
  new TerminateUnit(kernel);
  return { kernel, accountInfoUnit, accountPerformanceUnit, quoteDataUnit, periodDataUnit };
};
