import { formatTime } from '@yuants/data-model';
import { IOrder, Terminal } from '@yuants/protocol';
import { lastValueFrom, map, tap, toArray } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { HistoryOrderUnit } from './HistoryOrderUnit';

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
        this.terminal
          .queryDataRecords<IOrder>(
            {
              type: 'order',
              time_range: [start_time, end_time],
              tags: { account_id },
            },
            'MongoDB',
          )
          .pipe(
            //
            map((dataRecord) => dataRecord.origin),
            tap((order) => {
              const id = this.kernel.alloc(order.timestamp_in_us! / 1000);
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
