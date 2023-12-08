import { Labels } from './types';
import { Counter } from './counter';

export class Gauge extends Counter {
  dec(labels?: Labels): this {
    const metric = this.get(labels);
    this.set(metric ? metric.value - 1 : 0, labels);
    return this;
  }

  sub(amount: number, labels?: Labels): this {
    const metric = this.get(labels);
    this.set(metric ? metric.value - amount : 0, labels);
    return this;
  }
}
