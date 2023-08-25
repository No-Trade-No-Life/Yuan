import { IProduct, Terminal } from '@yuants/protocol';
import { Kernel } from '../kernel';
import {
  AccountPerformanceUnit,
  AccountSimulatorUnit,
  BasicUnit,
  HistoryPeriodLoadingUnit,
  HistoryOrderUnit,
  OrderLoadingUnit,
  OrderMatchingUnit,
  PeriodDataUnit,
  ProductDataUnit,
  ProductLoadingUnit,
  QuoteDataUnit,
  StopLossOrderMapperUnit,
} from '../units';
import { createEmptyAccountInfo } from '../utils';
import { lastValueFrom, map, toArray } from 'rxjs';

/**
 * 内建场景: 止损回放
 *
 * @public
 */
export const StopLossAccountReplayScene = (
  terminal: Terminal,
  account_id: string,
  currency: string,
  leverage: number,
  start_timestamp: number,
  end_timestamp: number,
  period_in_sec: number,
  resumeOnSourceMarginBelow: number,
  datasource_id?: string,
) => {
  const kernel = new Kernel();

  const productDataUnit = new ProductDataUnit(kernel);
  const quoteDataUnit = new QuoteDataUnit(kernel);

  const sourceHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const orderLoadingUnit = new OrderLoadingUnit(kernel, terminal, sourceHistoryOrderUnit);
  orderLoadingUnit.tasks.push({
    account_id,
    start_time: start_timestamp,
    end_time: end_timestamp,
  });
  // Adhoc Unit: 根据订单决定所需的品种信息
  // NOTE: 这里只需要在 Kernel 的各个 Unit Init 之后执行一次即可
  {
    new BasicUnit(kernel).onInit = () => {
      orderLoadingUnit.relatedProductIds.forEach((product_id) => {
        productLoadingUnit.productTasks.push({
          datasource_id: datasource_id ?? account_id,
          product_id,
        });
      });
    };
  }
  const productLoadingUnit = new ProductLoadingUnit(kernel, terminal, productDataUnit);
  // Adhoc Unit: 根据品种加载交叉盘品种
  {
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
  }
  // Adhoc Unit: 根据品种加载行情数据
  {
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
  }
  const periodDataUnit = new PeriodDataUnit(kernel, quoteDataUnit);
  const periodLoadingUnit = new HistoryPeriodLoadingUnit(kernel, terminal, productDataUnit, periodDataUnit);

  const initSourceAccountInfo = createEmptyAccountInfo(account_id, currency, leverage);
  const sourceAccountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    sourceHistoryOrderUnit,
    initSourceAccountInfo,
  );
  const sourceAccountPerformanceUnit = new AccountPerformanceUnit(kernel, sourceAccountInfoUnit);

  const targetHistoryOrderUnit = new HistoryOrderUnit(kernel, quoteDataUnit, productDataUnit);
  const initTargetAccountInfo = createEmptyAccountInfo(`${account_id}-SL`, currency, leverage);
  const accountInfoUnit = new AccountSimulatorUnit(
    kernel,
    productDataUnit,
    quoteDataUnit,
    targetHistoryOrderUnit,
    initTargetAccountInfo,
  );
  const targetOrderMatchingUnit = new OrderMatchingUnit(
    kernel,
    productDataUnit,
    periodDataUnit,
    targetHistoryOrderUnit,
  );
  const accountPerformanceUnit = new AccountPerformanceUnit(kernel, accountInfoUnit);

  const stopLossUnit = new StopLossOrderMapperUnit(
    kernel,
    initSourceAccountInfo.account_id,
    resumeOnSourceMarginBelow,
    productDataUnit,
    quoteDataUnit,
    sourceAccountInfoUnit,
    sourceAccountPerformanceUnit,
    sourceHistoryOrderUnit,
    targetOrderMatchingUnit,
    targetHistoryOrderUnit,
  );

  return { kernel, accountInfoUnit, accountPerformanceUnit };
};
