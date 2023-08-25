import { Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { OrderDirection } from '@yuants/protocol';
import { OrderMatchingUnit } from './OrderMatchingUnit';

/**
 * @public
 *
 * 反转仓位单元
 */
export class CounterpartyOrderMappingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public sourceOrderMatchingUnit: OrderMatchingUnit,
    public targetOrderMatchingUnit: OrderMatchingUnit,
  ) {
    super(kernel);
  }

  private subscriptions: Subscription[] = [];

  onInit(): void | Promise<void> {
    this.subscriptions.push(
      this.sourceOrderMatchingUnit.orderSubmitted$.subscribe((orders) => {
        this.targetOrderMatchingUnit.submitOrder(
          ...orders.map((order) => {
            const newOrder = { ...order };
            if (order.direction === OrderDirection.OPEN_LONG) {
              newOrder.direction = OrderDirection.OPEN_SHORT;
            } else if (order.direction === OrderDirection.OPEN_SHORT) {
              newOrder.direction = OrderDirection.OPEN_LONG;
            } else if (order.direction === OrderDirection.CLOSE_LONG) {
              newOrder.direction = OrderDirection.CLOSE_SHORT;
            } else if (order.direction === OrderDirection.CLOSE_SHORT) {
              newOrder.direction = OrderDirection.CLOSE_LONG;
            }
            return newOrder;
          }),
        );
      }),
    );
    this.subscriptions.push(
      this.sourceOrderMatchingUnit.orderCancelled$.subscribe((orderIds) => {
        this.targetOrderMatchingUnit.cancelOrder(...orderIds);
      }),
    );
  }

  onDispose(): void | Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }
}
