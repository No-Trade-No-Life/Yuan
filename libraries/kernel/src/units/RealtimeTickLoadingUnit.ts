import { ITick, decodePath, encodePath } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { QuoteDataUnit } from './QuoteDataUnit';
import { TickDataUnit } from './TickDataUnit';

/**
 * Realtime Tick
 * @public
 */
export class RealtimeTickLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public terminal: Terminal,
    public quoteDataUnit: QuoteDataUnit,
    public tickDataUnit: TickDataUnit,
  ) {
    super(kernel);
    this.kernel = kernel;
  }
  private mapEventIdToTick = new Map<number, ITick>();

  addTickTask(datasource_id: string, product_id: string, account_id: string = '') {
    this._tickTasks.add(encodePath(datasource_id, product_id, account_id));
  }

  private _tickTasks = new Set<string>();

  onEvent(): void | Promise<void> {
    const tick = this.mapEventIdToTick.get(this.kernel.currentEventId);
    if (tick) {
      this.quoteDataUnit.mapProductIdToQuote[tick.product_id] = {
        ask: tick.ask || tick.price,
        bid: tick.bid || tick.price,
      };

      this.tickDataUnit.setTick(tick);

      this.mapEventIdToTick.delete(this.kernel.currentEventId);
    }
  }

  private subscriptions: Subscription[] = [];

  async onInit() {
    // 配置行情查询任务
    for (const task of this._tickTasks) {
      const [datasource_id, product_id, account_id] = decodePath(task);

      this.subscriptions.push(
        this.terminal
          .consumeChannel<ITick>(encodePath('Tick', datasource_id, product_id))
          .subscribe((tick) => {
            const eventId = this.kernel.alloc(Date.now());
            if (account_id) {
              this.mapEventIdToTick.set(eventId, { ...tick, datasource_id: account_id });
            } else {
              this.mapEventIdToTick.set(eventId, tick);
            }
          }),
      );
    }
  }

  onDispose(): void | Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
