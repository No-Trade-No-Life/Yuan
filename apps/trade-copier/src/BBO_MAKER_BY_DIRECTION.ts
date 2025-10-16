import { useAccountInfo } from '@yuants/data-account';
import { IOrder, queryPendingOrders } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, roundToStep } from '@yuants/utils';
import { firstValueFrom, skip } from 'rxjs';
import { ITradeCopierStrategyBase } from './interface';
import { MetricRunStrategyContextGauge } from './metrics';

const terminal = Terminal.fromNodeEnv();

const _runStrategyBboMakerDirectional = async (
  account_id: string,
  productKey: string,
  direction: string,
  strategy: ITradeCopierStrategyBase,
) => {
  const expected_account_id = `TradeCopier/Expected/${account_id}`;
  const [datasource_id, product_id] = decodePath(productKey);
  // 一次性将所需的数据拉取完毕 (考虑性能优化可以使用 cache 机制)
  // 不同的下单策略所需的策略不同，这里先简单实现市价追入所需的数据
  const [[theProduct], actualAccountInfo, expectedAccountInfo, pendingOrders, [quote]] = await Promise.all([
    requestSQL<IProduct[]>(
      terminal,
      `select * from product where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
    // ISSUE: useAccountInfo 可能会拉到上一次没更新的数据，需要跳过一个来保证数据是最新的
    firstValueFrom(useAccountInfo(terminal, account_id).pipe(skip(1))),
    firstValueFrom(useAccountInfo(terminal, expected_account_id)),
    queryPendingOrders(terminal, account_id, true),
    requestSQL<IQuote[]>(
      terminal,
      `select * from quote where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
  ]);

  // 计算实际账户和预期账户的持仓差异
  const actualPositions = actualAccountInfo.positions.filter(
    (p) => p.product_id === product_id && p.direction === direction,
  );

  const actualVolume = actualPositions.reduce((a, b) => a + b.volume, 0);
  const actualAvgPositionPrice =
    actualVolume === 0
      ? 0
      : actualPositions.reduce((a, b) => a + b.volume * b.position_price, 0) / actualVolume;

  const expectedPositions = expectedAccountInfo.positions.filter(
    (p) => p.product_id === product_id && p.direction === direction,
  );

  const expectedVolume = expectedPositions.reduce((a, b) => a + b.volume, 0);
  const expectedAvgPositionPrice =
    expectedVolume === 0
      ? 0
      : expectedPositions.reduce((a, b) => a + b.volume * b.position_price, 0) / expectedVolume;

  const lowerBound = roundToStep(expectedVolume, theProduct.volume_step, Math.floor);
  const upperBound = roundToStep(expectedVolume, theProduct.volume_step, Math.ceil);
  const delta_volume =
    actualVolume < lowerBound
      ? lowerBound - actualVolume
      : actualVolume > upperBound
      ? upperBound - actualVolume
      : 0;

  const orders = pendingOrders.filter(
    (o) =>
      o.product_id === product_id &&
      { OPEN_LONG: 'LONG', CLOSE_LONG: 'LONG', OPEN_SHORT: 'SHORT', CLOSE_SHORT: 'SHORT' }[
        o.order_direction!
      ] === direction,
  );

  console.info(
    formatTime(Date.now()),
    'EchoContext',
    `account ${account_id}, product ${productKey}: actualVolume=${actualVolume}, actualPositionPrice=${actualAvgPositionPrice}, expectedVolume=${expectedVolume}, expectedPositionPrice=${expectedAvgPositionPrice}, bounds=[${lowerBound}, ${upperBound}], delta_volume=${delta_volume}, orders=${orders.length}`,
  );

  MetricRunStrategyContextGauge.set(actualVolume, {
    type: 'actual_volume',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(expectedVolume, {
    type: 'expected_volume',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(lowerBound, {
    type: 'lower_bound',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(upperBound, {
    type: 'upper_bound',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(delta_volume, {
    type: 'delta_volume',
    account_id,
    product: productKey,
  });

  if (orders.length > 1) {
    // 超过1个订单，为避免状态复杂化，直接全部撤单
    console.info(formatTime(Date.now()), `MoreThanOnePendingOrder`, JSON.stringify(orders));
    await Promise.allSettled(orders.map((o) => terminal.client.requestForResponse('CancelOrder', o)));
    return;
  }

  const isInExpectedRange = lowerBound <= actualVolume && actualVolume <= upperBound;
  // 实际值在容忍区间之间，不需要下单 (但是某些策略可能需要撤单)
  if (isInExpectedRange) {
    // 直接撤单
    console.info(formatTime(Date.now()), `InExpectedRange`, JSON.stringify(orders));
    await Promise.allSettled(orders.map((o) => terminal.client.requestForResponse('CancelOrder', o)));
    return;
  }

  let order_direction: string;
  let volume: number;
  let price: number;

  if (delta_volume > 0) {
    // 开仓
    price = direction === 'LONG' ? +quote.bid_price : +quote.ask_price;
    order_direction = direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';
    volume = delta_volume;

    // 仅在开仓时使用滑点保护 (因为平仓时，完成平仓优先于保护滑点)
    if (typeof strategy.open_slippage === 'number') {
      // 解方程: x * delta_volume + actualVolume * actualAvgPositionPrice === expectedVolume * expectedAvgPositionPrice * (1 + slippage)
      const x =
        (expectedVolume *
          expectedAvgPositionPrice *
          (1 + (direction === 'LONG' ? 1 : -1) * strategy.open_slippage) -
          actualVolume * actualAvgPositionPrice) /
        delta_volume; // 挂单限价
      console.info(formatTime(Date.now()), `SlippageProtection`, x);
      if (isNaN(x) || !isFinite(x)) {
        console.info(
          formatTime(Date.now()),
          'InvalidSlippageCalculation',
          `actualVolume=${actualVolume}, actualAvgPositionPrice=${actualAvgPositionPrice}, expectedVolume=${expectedVolume}, expectedAvgPositionPrice=${expectedAvgPositionPrice}, slippage=${strategy.open_slippage}`,
        );
        return;
      }
      if (direction === 'LONG') {
        price = Math.min(price, x);
      }
      if (direction === 'SHORT') {
        price = Math.max(price, x);
      }
    }
  } else {
    // 平仓
    price = direction === 'LONG' ? +quote.ask_price : +quote.bid_price;
    order_direction = direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
    volume = Math.min(-delta_volume, actualVolume);
  }

  const order: IOrder = {
    order_type: 'MAKER',
    account_id: account_id,
    product_id: product_id,
    order_direction: order_direction,
    price: roundToStep(price, theProduct.price_step),
    volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), theProduct.volume_step),
  };

  const theOrder = orders[0];
  if (theOrder) {
    if (
      order.volume !== theOrder.volume ||
      order.price !== theOrder.price ||
      order.order_direction !== theOrder.order_direction
    ) {
      console.info(
        formatTime(Date.now()),
        `NeedToUpdatePendingOrder`,
        JSON.stringify(theOrder),
        '=>',
        JSON.stringify(order),
      );
      await terminal.client.requestForResponse('CancelOrder', theOrder);
      return;
    }
    console.info(formatTime(Date.now()), `PendingOrderAlreadyExists`, JSON.stringify(theOrder));
    return;
  }

  console.info(formatTime(Date.now()), `OrderSubmitting`, JSON.stringify(order));
  const result = await terminal.client.requestForResponse('SubmitOrder', order);
  console.info(formatTime(Date.now()), `OrderSubmitted`, JSON.stringify(order), '=>', JSON.stringify(result));
};

export const runStrategyBboMakerByDirection = async (
  account_id: string,
  productKey: string,
  strategy: ITradeCopierStrategyBase,
) => {
  await Promise.allSettled([
    _runStrategyBboMakerDirectional(account_id, productKey, 'LONG', strategy),
    _runStrategyBboMakerDirectional(account_id, productKey, 'SHORT', strategy),
  ]);
};
