/**
 * A hook to manage a single position using Target Volume, Take Profit price and Stop Loss price.
 *
 * Use it when you need to place TP/SL orders for a position.
 */
export const useSinglePosition = (
  product_id: string,
  direction: string,
  account_id?: string,
): {
  targetVolume: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  setTargetVolume: (v: number) => void;
  setTakeProfitPrice: (v: number) => void;
  setStopLossPrice: (v: number) => void;
} & IPosition => {
  const position_id = useRef(UUID()).current;
  const ex = useExchange();
  const accountInfo = useAccountInfo({ account_id });
  const accountId = accountInfo.account_id;
  const position: IPosition = accountInfo.positions.find(
    (position) => position.position_id === position_id,
  ) || {
    position_id,
    product_id,
    direction,
    volume: 0,
    free_volume: 0,
    position_price: NaN,
    closable_price: NaN,
    floating_profit: 0,
  };
  const stopLossOrderRef = useRef<IOrder | null>(null);
  const takeProfitOrderRef = useRef<IOrder | null>(null);

  const product = useProduct('Y', product_id);

  const volume_step = product.volume_step ?? 1;

  const targetVolumeRef = useRef(0);
  const takeProfitPriceRef = useRef(0);
  const stopLossPriceRef = useRef(0);

  // TP or SL traded, reset all
  useEffect(() => {
    if (
      (takeProfitOrderRef.current && !ex.getOrderById(takeProfitOrderRef.current.order_id!)) ||
      (stopLossOrderRef.current && !ex.getOrderById(stopLossOrderRef.current.order_id!))
    ) {
      // cancel the rest
      ex.cancelOrder(takeProfitOrderRef.current?.order_id || '', stopLossOrderRef.current?.order_id || '');
      takeProfitOrderRef.current = null;
      stopLossOrderRef.current = null;
      targetVolumeRef.current = 0;
      takeProfitPriceRef.current = 0;
      stopLossPriceRef.current = 0;
    }
  });

  // Place Target order
  useEffect(() => {
    if (targetVolumeRef.current >= 0) {
      if (targetVolumeRef.current > position.volume) {
        const volume = roundToStep(targetVolumeRef.current - position.volume, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          order_id: UUID(),
          account_id: accountId,
          product_id: position.product_id,
          position_id: position.position_id,
          order_type: 'MARKET',
          order_direction: position.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
          volume: roundToStep(targetVolumeRef.current - position.volume, volume_step),
        };
        ex.submitOrder(order);
        return () => {
          ex.cancelOrder(order.order_id!);
        };
      }
      if (targetVolumeRef.current < position.volume) {
        const volume = roundToStep(position.volume - targetVolumeRef.current, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          order_id: UUID(),
          account_id: accountId,
          product_id: position.product_id,
          position_id: position.position_id,
          order_type: 'MARKET',
          order_direction: position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
          volume,
        };
        if (order.volume) ex.submitOrder(order);
        return () => {
          ex.cancelOrder(order.order_id!);
        };
      }
    }
  }, [targetVolumeRef.current, position.volume]);

  // If TakeProfit
  useEffect(() => {
    if (takeProfitPriceRef.current && position.volume) {
      const order: IOrder = {
        order_id: UUID(),
        account_id: accountId,
        product_id,
        position_id,
        order_type: 'LIMIT',
        order_direction: position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
        price: takeProfitPriceRef.current,
        volume: position.volume,
      };
      takeProfitOrderRef.current = order;
      ex.submitOrder(order);
      return () => {
        takeProfitOrderRef.current = null;
        ex.cancelOrder(order.order_id!);
      };
    }
  }, [takeProfitPriceRef.current, position.volume]);

  // If StopLoss
  useEffect(() => {
    if (stopLossPriceRef.current && position.volume) {
      const order: IOrder = {
        order_id: UUID(),
        account_id: accountId,
        product_id,
        position_id,
        order_type: 'STOP',
        order_direction: position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
        price: stopLossPriceRef.current,
        volume: position.volume,
      };
      stopLossOrderRef.current = order;
      ex.submitOrder(order);
      return () => {
        stopLossOrderRef.current = null;
        ex.cancelOrder(order.order_id!);
      };
    }
  }, [stopLossPriceRef.current, position.volume]);

  return {
    ...position,
    targetVolume: targetVolumeRef.current,
    takeProfitPrice: takeProfitPriceRef.current,
    stopLossPrice: stopLossPriceRef.current,
    setTargetVolume: (v) => {
      targetVolumeRef.current = v;
    },
    setTakeProfitPrice: (v) => {
      takeProfitPriceRef.current = v;
    },
    setStopLossPrice: (v) => {
      stopLossPriceRef.current = v;
    },
  };
};
