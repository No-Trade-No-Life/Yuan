import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { escape, requestSQL } from '@yuants/sql';
import { Kernel } from '../kernel';
import {
  AccountInfoUnit,
  AccountPerformanceHubUnit,
  BasicUnit,
  HistoryOrderUnit,
  HistoryPeriodLoadingUnit,
  OrderLoadingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  TerminateUnit,
} from '../units';

/**
 * 内建场景: 账户回放
 *
 * @public
 */
export const AccountReplayScene = (
  terminal: Terminal,
  account_id: string,
  currency: string,
  leverage: number,
  start_timestamp: number,
  end_timestamp: number,
  duration: string,
  datasource_id?: string,
) => {
  const kernel = new Kernel();

  const productDataUnit = new ProductDataUnit(kernel);
  const quoteDataUnit = new QuoteDataUnit(kernel);
  const historyOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const orderLoadingUnit = new OrderLoadingUnit(kernel, terminal, historyOrderUnit);
  orderLoadingUnit.tasks.push({
    account_id,
    start_time: start_timestamp,
    end_time: end_timestamp,
  });
  // Adhoc Unit: 根据订单决定所需的品种信息
  new BasicUnit(kernel).onInit = () => {
    orderLoadingUnit.relatedProductIds.forEach((product_id) => {
      productLoadingUnit.productTasks.push({
        datasource_id: datasource_id ?? account_id,
        product_id,
      });
    });
  };
  const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit);
  // Adhoc Unit: 根据品种加载交叉盘品种
  new BasicUnit(kernel).onInit = async () => {
    for (const product of productDataUnit.listProducts()) {
      const quote_currency = product.quote_currency;
      if (quote_currency && currency && product.quote_currency !== currency) {
        const [productA] = await requestSQL<IProduct[]>(
          terminal,
          `select * from product where datasource_id = ${escape(
            datasource_id ?? account_id,
          )} and base_currency = ${escape(currency)} and quote_currency = ${escape(quote_currency)}`,
        );
        if (productA) {
          productDataUnit.updateProduct(productA);
        }
        const [productB] = await requestSQL<IProduct[]>(
          terminal,
          `select * from product where datasource_id = ${escape(
            datasource_id ?? account_id,
          )} and base_currency = ${escape(quote_currency)} and quote_currency = ${escape(currency)}`,
        );
        if (productB) {
          productDataUnit.updateProduct(productB);
        }
      }
    }
  };
  // Adhoc Unit: 根据品种加载行情数据
  new BasicUnit(kernel).onInit = () => {
    for (const product of productDataUnit.listProducts()) {
      periodLoadingUnit.periodTasks.push({
        datasource_id: datasource_id ?? account_id,
        product_id: product.product_id,
        duration,
        start_time_in_us: start_timestamp * 1000,
        end_time_in_us: end_timestamp * 1000,
      });
    }
  };

  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, productDataUnit, periodDataUnit);
  const accountInfoUnit = new AccountInfoUnit(kernel, productDataUnit, quoteDataUnit, historyOrderUnit);
  accountInfoUnit.useAccount(account_id, currency, leverage);

  const accountPerformanceUnit = new AccountPerformanceHubUnit(kernel, accountInfoUnit);
  new TerminateUnit(kernel);
  return { kernel, accountInfoUnit, accountPerformanceUnit };
};
