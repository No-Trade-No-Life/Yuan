/**
 * Derive a Counter Party account from the source account.
 *
 * The derived account has the same positions as the source account, but the positions' direction is reversed.
 */
export function useCounterParty(source_account_id: string) {
  const src = useAccountInfo({ account_id: source_account_id });
  const tar = useAccountInfo({
    account_id: `${source_account_id}-CP`,
    currency: src.money.currency,
    leverage: src.money.leverage,
  });

  const ex = useExchange();
  useEffect(() => {
    const orders: IOrder[] = [];
    for (const order of ex.listOrders()) {
      if (order.account_id === src.account_id) {
        const theOrder = {
          ...order,
          account_id: tar.account_id,
          order_id: UUID(),
          type:
            order.order_type === 'STOP' ? 'LIMIT' : order.order_type === 'LIMIT' ? 'STOP' : order.order_type,
          direction:
            order.order_direction === 'OPEN_LONG'
              ? 'OPEN_SHORT'
              : order.order_direction === 'OPEN_SHORT'
              ? 'OPEN_LONG'
              : order.order_direction === 'CLOSE_LONG'
              ? 'CLOSE_SHORT'
              : order.order_direction === 'CLOSE_SHORT'
              ? 'CLOSE_LONG'
              : order.order_direction,
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
}
