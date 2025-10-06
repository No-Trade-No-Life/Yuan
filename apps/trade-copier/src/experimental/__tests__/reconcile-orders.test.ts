import { IOrder } from '@yuants/data-order';
import { reconcileOrders } from '../reconcile-orders';

describe('reconcileOrders', () => {
  const baseOrder: IOrder = {
    account_id: 'test_account',
    product_id: 'BTC/USDT',
    order_type: 'MAKER',
    order_direction: 'OPEN_LONG',
    price: 50000,
    volume: 1,
  };

  it('应该返回空数组当当前订单和目标订单完全相同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([]);
  });

  it('应该撤单当目标订单为空', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders: IOrder[] = [];

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该下单当当前订单为空', () => {
    const currentOrders: IOrder[] = [];
    const targetOrders = [{ ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'SubmitOrder',
        payload: targetOrders[0],
      },
    ]);
  });

  it('应该撤单当订单参数不同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, price: 51000 }]; // 价格不同

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该撤单当订单方向不同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, order_direction: 'OPEN_SHORT' }]; // 方向不同

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该撤单当订单数量不同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, volume: 2 }]; // 数量不同

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该撤单当账户不同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, account_id: 'different_account' }]; // 账户不同

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该撤单当产品不同', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, product_id: 'ETH/USDT' }]; // 产品不同

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);
  });

  it('应该先撤单再下单（分两轮执行）', () => {
    // 第一轮：有撤单需求，只撤单
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, price: 51000 }];

    const actions1 = reconcileOrders(currentOrders, targetOrders);
    expect(actions1).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
    ]);

    // 第二轮：假设撤单成功，当前订单为空，执行下单
    const currentOrdersAfterCancel: IOrder[] = [];
    const actions2 = reconcileOrders(currentOrdersAfterCancel, targetOrders);
    expect(actions2).toEqual([
      {
        type: 'SubmitOrder',
        payload: targetOrders[0],
      },
    ]);
  });

  it('应该处理多个订单的撤单', () => {
    const currentOrders = [{ ...baseOrder }, { ...baseOrder, product_id: 'ETH/USDT' }];
    const targetOrders = [{ ...baseOrder, price: 51000 }]; // 只保留一个修改后的订单

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'CancelOrder',
        payload: currentOrders[0],
      },
      {
        type: 'CancelOrder',
        payload: currentOrders[1],
      },
    ]);
  });

  it('应该处理多个订单的下单', () => {
    const currentOrders: IOrder[] = [];
    const targetOrders = [{ ...baseOrder }, { ...baseOrder, product_id: 'ETH/USDT' }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    expect(actions).toEqual([
      {
        type: 'SubmitOrder',
        payload: targetOrders[0],
      },
      {
        type: 'SubmitOrder',
        payload: targetOrders[1],
      },
    ]);
  });

  it('应该优化性能：有撤单时不计算下单订单', () => {
    const currentOrders = [{ ...baseOrder }];
    const targetOrders = [{ ...baseOrder, price: 51000 }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    // 验证只返回撤单动作，没有下单动作
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CancelOrder');
  });

  it('应该撤单一个订单当 currentOrders 有两个重复订单而 targetOrders 只有一个', () => {
    // currentOrders 有两个完全相同的订单
    const currentOrders = [
      { ...baseOrder },
      { ...baseOrder }, // 完全相同的重复订单
    ];

    // targetOrders 只有一个相同的订单
    const targetOrders = [{ ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    // 预期：应该撤单一个订单
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CancelOrder');
    // 注意：由于两个订单完全相同，撤单哪一个都可以
  });

  it('应该撤单两个订单当 currentOrders 有三个重复订单而 targetOrders 只有一个', () => {
    // currentOrders 有三个完全相同的订单
    const currentOrders = [{ ...baseOrder }, { ...baseOrder }, { ...baseOrder }];

    // targetOrders 只有一个相同的订单
    const targetOrders = [{ ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    // 预期：应该撤单两个订单
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('CancelOrder');
    expect(actions[1].type).toBe('CancelOrder');
  });

  it('应该下单一个订单当 currentOrders 有一个订单而 targetOrders 有两个重复订单', () => {
    // currentOrders 有一个订单
    const currentOrders = [{ ...baseOrder }];

    // targetOrders 有两个完全相同的订单
    const targetOrders = [{ ...baseOrder }, { ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    // 预期：应该下单一个订单
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
  });

  it('应该撤单两个订单且订单ID不同当当前订单有三个只有order_id不同的订单而目标订单只有一个', () => {
    // currentOrders 有三个只有 order_id 不同的订单
    const currentOrders = [
      { ...baseOrder, order_id: 'order-1' },
      { ...baseOrder, order_id: 'order-2' },
      { ...baseOrder, order_id: 'order-3' },
    ];

    // targetOrders 只有一个相同的订单（没有 order_id）
    const targetOrders = [{ ...baseOrder }];

    const actions = reconcileOrders(currentOrders, targetOrders);

    // 预期：应该撤单两个订单
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('CancelOrder');
    expect(actions[1].type).toBe('CancelOrder');

    // 验证两个撤单动作中的订单ID不同
    const orderIds = actions.map((action) => action.payload.order_id);
    expect(orderIds).toHaveLength(2);
    expect(new Set(orderIds).size).toBe(2); // 确保两个订单ID不同
  });
});
