import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath } from '@yuants/utils';
import { defer, takeUntil } from 'rxjs';
import { Kernel } from '../kernel';
import { AccountDatasourceRelationUnit } from './AccountDatasouceRelationUnit';
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
  private mapEventIdToTick = new Map<number, IQuote>();

  addTickTask(datasource_id: string, product_id: string, account_id: string = '') {
    this.kernel
      .findUnit(AccountDatasourceRelationUnit)
      ?.updateRelation({ datasource_id, product_id, account_id });
    this._tickTasks.add(encodePath(datasource_id, product_id, account_id));
  }

  private _tickTasks = new Set<string>();

  onEvent(): void | Promise<void> {
    const tick = this.mapEventIdToTick.get(this.kernel.currentEventId);
    if (tick && tick.ask_price && tick.bid_price) {
      this.quoteDataUnit.updateQuote(tick.datasource_id, tick.product_id, +tick.ask_price, +tick.bid_price);

      this.tickDataUnit.setTick(tick);

      this.mapEventIdToTick.delete(this.kernel.currentEventId);
    }
  }

  async onInit() {
    // 配置行情查询任务
    for (const task of this._tickTasks) {
      const [datasource_id, product_id, account_id] = decodePath(task);

      defer(() =>
        this.terminal.channel.subscribeChannel<IQuote>('Tick', encodePath(datasource_id, product_id)),
      )
        .pipe(takeUntil(this.kernel.dispose$))
        .subscribe((tick) => {
          const eventId = this.kernel.alloc(Date.now());
          if (account_id) {
            this.mapEventIdToTick.set(eventId, { ...tick, datasource_id: account_id });
          } else {
            this.mapEventIdToTick.set(eventId, tick);
          }
        });
    }
  }
}
