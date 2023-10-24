import { UUID } from '@yuants/data-model';
import { IOrder, IPosition, IProduct, OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import { useAgent, useEffect, useRef, useState } from './basic-set';

/**
 * 使用单个头寸的管理器
 * @param product_id - 品种ID
 * @param variant - 头寸类型
 * @param account_id - 账户ID
 * @public
 */
export const useSinglePosition = (
  product_id: string,
  variant: PositionVariant,
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
  const agent = useAgent();
  const theAccountId = account_id || agent.options.account_id;
  const position = agent.accountInfoUnit.getPosition(theAccountId, position_id, product_id, variant);
  const stopLossOrderRef = useRef<IOrder | null>(null);
  const takeProfitOrderRef = useRef<IOrder | null>(null);

  const productRef = useRef<IProduct | null>(null);
  useEffect(() => {
    productRef.current = agent.productDataUnit.mapProductIdToProduct[product_id] ?? null;
  }, [Object.values(agent.productDataUnit.mapProductIdToProduct).length]);

  const volume_step = productRef.current?.volume_step ?? 1e-9;

  const [targetVolume, setTargetVolume] = useState(0);
  const [stopLossPrice, setStopLossPrice] = useState(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState(0);

  useEffect(() => {
    if (takeProfitOrderRef.current?.traded_volume) {
      setTargetVolume(targetVolume - takeProfitOrderRef.current.traded_volume);
    }
  }, [takeProfitOrderRef.current?.traded_volume]);

  useEffect(() => {
    if (stopLossOrderRef.current?.traded_volume) {
      setTargetVolume(targetVolume - stopLossOrderRef.current.traded_volume);
    }
  }, [stopLossOrderRef.current?.traded_volume]);

  useEffect(() => {
    if (targetVolume >= 0) {
      if (targetVolume > position.volume) {
        const volume = roundToStep(targetVolume - position.volume, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          client_order_id: UUID(),
          account_id: theAccountId,
          product_id: position.product_id,
          position_id: position.position_id,
          type: OrderType.MARKET,
          direction:
            position.variant === PositionVariant.LONG ? OrderDirection.OPEN_LONG : OrderDirection.OPEN_SHORT,
          volume: roundToStep(targetVolume - position.volume, volume_step),
        };
        agent.orderMatchingUnit.submitOrder(order);
        return () => {
          agent.orderMatchingUnit.cancelOrder(order.client_order_id);
        };
      }
      if (targetVolume < position.volume) {
        const volume = roundToStep(position.volume - targetVolume, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          client_order_id: UUID(),
          account_id: theAccountId,
          product_id: position.product_id,
          position_id: position.position_id,
          type: OrderType.MARKET,
          direction:
            position.variant === PositionVariant.LONG
              ? OrderDirection.CLOSE_LONG
              : OrderDirection.CLOSE_SHORT,
          volume,
        };
        if (order.volume) agent.orderMatchingUnit.submitOrder(order);
        return () => {
          agent.orderMatchingUnit.cancelOrder(order.client_order_id);
        };
      }
    }
  }, [targetVolume, position.volume]);

  useEffect(() => {
    if (takeProfitPrice && position.volume) {
      const order: IOrder = {
        client_order_id: UUID(),
        account_id: theAccountId,
        product_id,
        position_id,
        type: OrderType.LIMIT,
        direction:
          position.variant === PositionVariant.LONG ? OrderDirection.CLOSE_LONG : OrderDirection.CLOSE_SHORT,
        price: takeProfitPrice,
        volume: position.volume,
      };
      takeProfitOrderRef.current = order;
      agent.orderMatchingUnit.submitOrder(order);
      return () => {
        // 撤单
        takeProfitOrderRef.current = null;
        agent.orderMatchingUnit.cancelOrder(order.client_order_id);
      };
    }
  }, [takeProfitPrice, position.volume]);

  useEffect(() => {
    if (stopLossPrice && position.volume) {
      const order: IOrder = {
        client_order_id: UUID(),
        account_id: theAccountId,
        product_id,
        position_id,
        type: OrderType.STOP,
        direction:
          position.variant === PositionVariant.LONG ? OrderDirection.CLOSE_LONG : OrderDirection.CLOSE_SHORT,
        price: stopLossPrice,
        volume: position.volume,
      };
      stopLossOrderRef.current = order;
      agent.orderMatchingUnit.submitOrder(order);
      return () => {
        // 撤单
        stopLossOrderRef.current = null;
        agent.orderMatchingUnit.cancelOrder(order.client_order_id);
      };
    }
  }, [stopLossPrice, position.volume]);

  return {
    ...position,
    targetVolume: targetVolume,
    takeProfitPrice: takeProfitPrice,
    stopLossPrice: stopLossPrice,
    setTargetVolume,
    setTakeProfitPrice,
    setStopLossPrice,
  };
};
