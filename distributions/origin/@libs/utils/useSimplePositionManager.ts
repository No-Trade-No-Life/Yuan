/**
 * Use a single target net volume to control the position (LONG & SHORT).
 *
 * The position will be opened/closed by market orders.
 *
 * Positive for LONG, negative for SHORT, zero for close both LONG and SHORT positions.
 */
export const useSimplePositionManager = (
  account_id: string,
  product_id: string,
): [number, (v: number) => void] => {
  // useState: when setTargetVolume, re-execute the agent code.
  const [targetVolume, setTargetVolume] = useState(0);
  // Get reference to the account info.
  const accountInfo = useAccountInfo({ account_id });
  // Use the exchange to submit & cancel orders.
  const exchange = useExchange();

  // Generate a random UUID for each position.
  const longPositionId = useMemo(() => UUID(), []);
  const shortPositionId = useMemo(() => UUID(), []);

  // Get actual volume of the positions.
  const longPositionVolume =
    accountInfo.positions.find((position) => position.position_id === longPositionId)?.volume ?? 0;
  const shortPositionVolume =
    accountInfo.positions.find((position) => position.position_id === shortPositionId)?.volume ?? 0;

  // Calc the volume to open/close.
  const openLongVolume = Math.max(targetVolume - longPositionVolume, 0);
  const openShortVolume = Math.max(-targetVolume - shortPositionVolume, 0);
  const closeLongVolume = Math.min(longPositionVolume - targetVolume, longPositionVolume);
  const closeShortVolume = Math.min(shortPositionVolume - -targetVolume, shortPositionVolume);

  // OPEN LONG: submit & cancel order.
  useEffect(() => {
    if (openLongVolume <= 0) return;
    const order: IOrder = {
      order_id: UUID(),
      account_id,
      product_id,
      position_id: longPositionId,
      order_type: 'MARKET',
      order_direction: 'OPEN_LONG',
      volume: openLongVolume,
    };
    exchange.submitOrder(order);
    return () => {
      exchange.cancelOrder(order.order_id!);
    };
  }, [openLongVolume]);

  // OPEN SHORT: submit & cancel order.
  useEffect(() => {
    if (openShortVolume <= 0) return;
    const order: IOrder = {
      order_id: UUID(),
      account_id,
      product_id,
      position_id: shortPositionId,
      order_type: 'MARKET',
      order_direction: 'OPEN_SHORT',
      volume: openShortVolume,
    };
    exchange.submitOrder(order);
    return () => {
      exchange.cancelOrder(order.order_id!);
    };
  }, [openShortVolume]);

  // CLOSE LONG: submit & cancel order.
  useEffect(() => {
    if (closeLongVolume <= 0) return;
    const order: IOrder = {
      order_id: UUID(),
      account_id,
      product_id,
      position_id: longPositionId,
      order_type: 'MARKET',
      order_direction: 'CLOSE_LONG',
      volume: closeLongVolume,
    };
    exchange.submitOrder(order);
    return () => {
      exchange.cancelOrder(order.order_id!);
    };
  }, [closeLongVolume]);

  // CLOSE SHORT: submit & cancel order.
  useEffect(() => {
    if (closeShortVolume <= 0) return;
    const order: IOrder = {
      order_id: UUID(),
      account_id,
      product_id,
      position_id: shortPositionId,
      order_type: 'MARKET',
      order_direction: 'CLOSE_SHORT',
      volume: closeShortVolume,
    };
    exchange.submitOrder(order);
    return () => {
      exchange.cancelOrder(order.order_id!);
    };
  }, [closeShortVolume]);

  // returns the target volume and the setter.
  return [targetVolume, setTargetVolume];
};
