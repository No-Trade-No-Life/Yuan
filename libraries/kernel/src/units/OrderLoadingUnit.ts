import { IOrder } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { escape, requestSQL } from '@yuants/sql';
import { defer, lastValueFrom, mergeMap, tap, toArray } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';
import { formatTime } from '@yuants/utils';

/**
 * 历史订单加载单元
 * @public
 */
export class OrderLoadingUnit extends BasicUnit {
  constructor(public kernel: Kernel, public terminal: Terminal, public historyOrderUnit: HistoryOrderUnit) {
    super(kernel);
  }
  tasks: { account_id: string; start_time: number; end_time: number }[] = [];
  /** 相关品种ID */
  relatedProductIds = new Set<string>();

  private mapEventIdToOrder = new Map<number, IOrder>();
  async onInit() {
    this.kernel.log?.(formatTime(Date.now()), `开始加载历史订单，共 ${this.tasks.length} 个任务`);
    for (const task of this.tasks) {
      const { account_id, start_time, end_time } = task;
      this.kernel.log?.(
        `${formatTime(Date.now())} 开始加载历史订单 ${account_id} ${formatTime(start_time)} ~ ${formatTime(
          end_time,
        )}`,
      );
      const orders = await lastValueFrom(
        defer(() =>
          requestSQL<IOrder[]>(
            this.terminal,
            `select * from order where account_id = ${escape(account_id)} and created_at >= ${escape(
              formatTime(start_time),
            )} and created_at < ${escape(formatTime(end_time))}`,
          ),
        ).pipe(
          //
          mergeMap((x) => x),
          tap((order) => {
            const id = this.kernel.alloc(order.submit_at!);
            this.mapEventIdToOrder.set(id, order);
            this.relatedProductIds.add(order.product_id);
          }),
          toArray(),
        ),
      );
      this.kernel.log?.(
        `${formatTime(Date.now())} 完成加载历史订单 ${account_id} ${formatTime(start_time)} ~ ${formatTime(
          end_time,
        )}，共 ${orders.length} 条`,
      );
    }
  }
  onEvent(): void | Promise<void> {
    const order = this.mapEventIdToOrder.get(this.kernel.currentEventId);
    if (order) {
      this.historyOrderUnit.updateOrder(order);
      this.mapEventIdToOrder.delete(this.kernel.currentEventId);
    }
  }
}
