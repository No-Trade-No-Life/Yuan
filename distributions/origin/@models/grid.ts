import { useParamNumber, useParamString } from '@libs';
// 单向做多等差网格交易策略
export default () => {
  const datasource_id = useParamString('数据源', 'Y');
  const product_id = useParamString('品种');
  const period = useParamString('周期', 'PT1H');
  const grid_upper = useParamNumber('网格上限');
  const grid_lower = useParamNumber('网格下限');
  const grid_count = useParamNumber('网格数量');
  const leverage = useParamNumber('杠杆', 1);
  const currency = useParamString('币种', 'USD');

  const { close } = useOHLC(datasource_id, product_id, period);

  const GRIDS = useMemo(
    () =>
      Array.from({ length: grid_count + 1 }).map(
        (_, i) => grid_lower + ((grid_upper - grid_lower) / grid_count) * i,
      ),
    [],
  );

  const exchange = useExchange();
  const accountInfo = useAccountInfo({ leverage, currency });

  useEffect(() => {
    const orders: IOrder[] = [];
    for (let idx = 0; idx < grid_count; idx++) {
      const grid = GRIDS[idx];
      const thePosition = accountInfo.positions.find((pos) => pos.position_id === `${grid}`);
      if (!thePosition && close[close.length - 1] > grid) {
        orders.push({
          order_id: UUID(),
          account_id: accountInfo.account_id,
          product_id,
          position_id: `${grid}`,
          order_type: 'LIMIT',
          order_direction: 'OPEN_LONG',
          volume: 1,
          price: grid,
        });
      }
      if (thePosition) {
        orders.push({
          order_id: UUID(),
          account_id: accountInfo.account_id,
          product_id,
          position_id: `${grid}`,
          order_type: 'LIMIT',
          order_direction: 'CLOSE_LONG',
          volume: 1,
          price: GRIDS[idx + 1],
        });
      }
    }

    exchange.submitOrder(...orders);
    return () => {
      for (const order of orders) {
        exchange.cancelOrder(order.order_id!);
      }
    };
  });
};
