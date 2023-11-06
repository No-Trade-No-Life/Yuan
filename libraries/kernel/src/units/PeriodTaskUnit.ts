import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';

/**
 * @public
 */
export class DataLoadingTaskUnit extends BasicUnit {
  constructor(public kernel: Kernel) {
    super(kernel);
  }
  periodTasks: {
    datasource_id: string;
    product_id: string;
    period_in_sec: number;
    start_time_in_us: number;
    end_time_in_us: number;
  }[] = [];

  productTasks: { datasource_id: string; product_id: string }[] = [];

  dump() {
    return {
      periodTasks: this.periodTasks,
      productTasks: this.productTasks,
    };
  }
  restore(state: any): void {
    this.periodTasks = state.periodTasks;
    this.productTasks = state.productTasks;
  }
}
