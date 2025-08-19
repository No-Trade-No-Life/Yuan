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
    series_id: string;
    start_time: number;
    end_time: number;
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
