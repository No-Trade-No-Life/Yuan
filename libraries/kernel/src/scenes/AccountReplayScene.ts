import { IAccountInfo, IProduct, Terminal } from '@yuants/protocol';
import { lastValueFrom, map, toArray } from 'rxjs';
import { Kernel } from '../kernel';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  HistoryPeriodLoadingUnit,
  HistoryOrderUnit,
  OrderLoadingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
} from '../units';
import { createEmptyAccountInfo } from '../utils';

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
  period_in_sec: number,
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
    for (const product of Object.values(productDataUnit.mapProductIdToProduct)) {
      if (product.base_currency !== currency && product.quoted_currency !== currency) {
        const [productA] = await lastValueFrom(
          terminal
            .queryDataRecords<IProduct>(
              {
                type: 'product',
                tags: {
                  datasource_id: datasource_id ?? account_id,
                  base_currency: product.base_currency,
                  quoted_currency: currency,
                },
              },
              'MongoDB',
            )
            .pipe(
              map((dataRecord) => dataRecord.origin),
              toArray(),
            ),
        );
        if (productA) {
          productDataUnit.mapProductIdToProduct[productA.product_id] = productA;
        }
        const [productB] = await lastValueFrom(
          terminal
            .queryDataRecords<IProduct>(
              {
                type: 'product',
                tags: {
                  datasource_id: datasource_id ?? account_id,
                  base_currency: currency,
                  quoted_currency: product.base_currency,
                },
              },
              'MongoDB',
            )
            .pipe(
              map((dataRecord) => dataRecord.origin),
              toArray(),
            ),
        );
        if (productB) {
          productDataUnit.mapProductIdToProduct[productB.product_id] = productB;
        }
      }
    }
  };
  // Adhoc Unit: 根据品种加载行情数据
  new BasicUnit(kernel).onInit = () => {
    for (const product of Object.values(productDataUnit.mapProductIdToProduct)) {
      periodLoadingUnit.periodTasks.push({
        datasource_id: datasource_id ?? account_id,
        product_id: product.product_id,
        period_in_sec,
        start_time_in_us: start_timestamp * 1000,
        end_time_in_us: end_timestamp * 1000,
      });
    }
  };

  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, productDataUnit, periodDataUnit);
  const initAccountInfo: IAccountInfo = createEmptyAccountInfo(account_id, currency, leverage);
  const accountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    historyOrderUnit,
    initAccountInfo,
  );
  const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);
  return { kernel, accountInfoUnit, accountPerformanceUnit };
};
