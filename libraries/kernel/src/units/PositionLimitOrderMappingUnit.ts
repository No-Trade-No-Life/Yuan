import { Subscription, filter, from, map, mergeMap, toArray } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { OrderMatchingUnit } from './OrderMatchingUnit';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { mergePositions } from '../utils';
import { OrderDirection, PositionVariant } from '@yuants/protocol';

/**
 * @public
 *
 * Position Limit Unit
 */
export class PositionLimitOrderMappingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    // TODO: associate with a product
    public positionLimit: number,
    public sourceOrderMatchingUnit: OrderMatchingUnit,
    public targetOrderMatchingUnit: OrderMatchingUnit,
    public targetAccountInfoUnit: AccountSimulatorUnit,
  ) {
    super(kernel);
  }

  private subscriptions: Subscription[] = [];

  a = () => {};

  onInit(): void | Promise<void> {
    this.subscriptions.push(
      this.sourceOrderMatchingUnit.orderSubmitted$
        .pipe(
          //
          mergeMap((orders) => {
            const mapProductToPosition = Object.fromEntries(
              mergePositions(this.targetAccountInfoUnit.accountInfo.positions).map((position) => [
                `${position.product_id}-${position.variant}`,
                position,
              ]),
            );
            return from(orders).pipe(
              //
              map((order) => {
                const positionVolume =
                  mapProductToPosition[
                    `${order.product_id}-${
                      [OrderDirection.CLOSE_LONG, OrderDirection.OPEN_LONG].includes(order.direction)
                        ? PositionVariant.LONG
                        : PositionVariant.SHORT
                    }`
                  ]?.volume ?? 0;
                if ([OrderDirection.CLOSE_LONG, OrderDirection.CLOSE_SHORT].includes(order.direction)) {
                  return { ...order, volume: Math.min(order.volume, positionVolume) };
                }
                return {
                  ...order,
                  volume: Math.min(order.volume, this.positionLimit - positionVolume),
                };
              }),
              filter((order) => order.volume > 0),
              toArray(),
            );
          }),
        )
        .subscribe((orders) => {
          this.targetOrderMatchingUnit.submitOrder(...orders);
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
