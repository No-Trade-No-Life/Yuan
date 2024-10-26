import { getClosePriceByDesiredProfit } from './getClosePriceByDesiredProfit';
import { mergePositions } from './mergePositions';

export const useStopLossOnSingleProduct = (
  source_account_id: string,
  source_datasource_id: string,
  source_product_id: string,
  stopLossDrawdownQuota: number,
) => {
  //
  const hasStopped = useRef(false);
  // if some of these orders are filled, means stop loss
  const stopLossOrders = useRef(new Set<IOrder>());
  const ex = useExchange();
  const src = useAccountInfo({ account_id: source_account_id });
  const tar = useAccountInfo({
    account_id: `${source_account_id}-SL_${stopLossDrawdownQuota}`,
    currency: src.money.currency,
    leverage: src.money.leverage,
  });
  const stopLossVolume = useRef(NaN);
  const product = useProduct(source_datasource_id, source_product_id);
  const log = useLog();

  // check if should stop loss
  useEffect(() => {
    if (hasStopped.current) return;
    for (const order of stopLossOrders.current.values()) {
      const theOrder = ex.getOrderById(order.order_id!);
      if (!theOrder) {
        log('Triggered StopLoss Event');
        hasStopped.current = true;
        stopLossOrders.current.clear();
        const currentVolume = src.positions.reduce(
          (acc, cur) =>
            cur.product_id === source_product_id
              ? acc + (cur.direction === 'LONG' ? 1 : -1) * cur.volume
              : acc,
          0,
        );
        stopLossVolume.current = currentVolume;
        return;
      }
    }
  });

  // resume if source account position is close or reverse
  useEffect(() => {
    if (!hasStopped.current) return;
    const currentVolume = src.positions.reduce(
      (acc, cur) =>
        cur.product_id === source_product_id ? acc + (cur.direction === 'LONG' ? 1 : -1) * cur.volume : acc,
      0,
    );
    if (currentVolume === 0 || currentVolume * stopLossVolume.current < 0) {
      log('Resume following');
      hasStopped.current = false;
      stopLossVolume.current = NaN;
      // follow the positions
      const mergedPositions = mergePositions(src.positions);
      for (const position of mergedPositions) {
        const order: IOrder = {
          order_id: UUID(),
          account_id: tar.account_id,
          product_id: position.product_id,
          position_id: position.position_id,
          order_type: 'MARKET',
          order_direction: position.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
          volume: position.volume,
        };
        ex.submitOrder(order);
      }

      return;
    }
  });

  // place stop loss order
  useEffect(() => {
    if (hasStopped.current) return;

    const drawdown_quota = stopLossDrawdownQuota + tar.money.profit;
    const mapProductIdVariantToClosePrice: Record<string, number> = {};
    const mergedPositions = mergePositions(tar.positions);
    for (const position of mergedPositions) {
      const price = getClosePriceByDesiredProfit(
        product,
        position.position_price,
        position.volume,
        -(drawdown_quota - position.floating_profit),
        position.direction!,
        tar.money.currency,
        (product_id) => ex.getQuote(source_account_id, product_id) || { ask: 1, bid: 1 },
      );
      mapProductIdVariantToClosePrice[`${position.product_id}${position.direction}`] = price;
    }
    // ISSUE: 需要按照计算好的平仓价格分别平掉每一个头寸
    for (const position of tar.positions) {
      const closePrice = mapProductIdVariantToClosePrice[`${position.product_id}${position.direction}`];
      if (Number.isNaN(closePrice)) {
        continue;
      }
      const order: IOrder = {
        order_id: UUID(),
        account_id: tar.account_id,
        product_id: position.product_id,
        position_id: position.position_id,
        order_type: 'STOP',
        order_direction: position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
        volume: position.volume,
        price: closePrice,
      };
      stopLossOrders.current.add(order);
    }
    ex.submitOrder(...stopLossOrders.current);
    return () => {
      stopLossOrders.current.forEach((order) => {
        ex.cancelOrder(order.order_id!);
      });
      stopLossOrders.current.clear();
    };
  });

  // close all positions if stop loss
  useEffect(() => {
    if (!hasStopped.current) return;

    const orders: IOrder[] = [];
    for (const position of tar.positions) {
      const order: IOrder = {
        order_id: UUID(),
        account_id: tar.account_id,
        order_type: 'MARKET',
        position_id: position.position_id,
        order_direction: position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
        product_id: position.product_id,
        volume: position.volume,
      };
      orders.push(order);
      ex.submitOrder(order);
    }
    return () => {
      for (const order of orders) {
        ex.cancelOrder(order.order_id!);
      }
    };
  });

  // follow source account if not stop loss
  useEffect(() => {
    if (hasStopped.current) return;
    const orders: IOrder[] = [];
    for (const order of ex.listOrders()) {
      if (order.account_id === source_account_id) {
        const theOrder = {
          ...order,
          account_id: tar.account_id,
          order_id: UUID(),
          volume: order.volume,
        };
        ex.submitOrder(theOrder);
        orders.push(theOrder);
      }
    }
    return () => {
      for (const order of orders) {
        ex.cancelOrder(order.order_id!);
      }
    };
  });

  return tar;
};
