import { Kernel } from '../../kernel';
import { AccountSimulatorUnit } from '../AccountSimulatorUnit';
import { BasicUnit } from '../BasicUnit';
import { HistoryPeriodLoadingUnit } from '../HistoryPeriodLoadingUnit';
import { OrderMatchingUnit } from '../OrderMatchingUnit';
import { PeriodDataUnit } from '../PeriodDataUnit';
import { ProductDataUnit } from '../ProductDataUnit';
import { ProductLoadingUnit } from '../ProductLoadingUnit';
import { SeriesDataUnit } from '../SeriesDataUnit';
import { ScriptNode } from './script-node';

/**
 * 时间序列数据
 *
 * @public
 */
export interface ISeries {
  series_id: string;
  tags: Record<string, any>;
  value: number[];
}

/**
 * 自定义脚本单元
 * @public
 */
export class ScriptUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public productDataUnit: ProductDataUnit,
    public productLoadingUnit: ProductLoadingUnit | null,
    public periodLoadingUnit: HistoryPeriodLoadingUnit | null,
    public periodDataUnit: PeriodDataUnit,
    public orderMatchingUnit: OrderMatchingUnit,
    public accountInfoUnit: AccountSimulatorUnit,
    public seriesDataUnit: SeriesDataUnit,
    public scriptResolver: { readFile: (path: string) => Promise<string> },
    public scriptPath: string,
    public scriptParams: Record<string, any>,
    public options: {
      start_time: number;
      end_time: number;
    },
  ) {
    super(kernel);
  }

  record_table: Record<string, Record<string, string | number>[]> = {};

  root = new ScriptNode(this, this.scriptPath, '/', this.scriptParams);

  /** 初始化节点 (加载所有依赖的脚本) */
  async init() {
    return this.root.init();
  }

  onEvent(): void | Promise<void> {
    this.root.update();
  }
}
