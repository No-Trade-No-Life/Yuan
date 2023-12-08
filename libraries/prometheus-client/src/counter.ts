import { Collector } from './collector';
import { CounterValue, Labels } from './types';

export class Counter extends Collector<CounterValue> {
  inc(labels?: Labels): this {
    this.add(1, labels);
    return this;
  }

  add(amount: number, labels?: Labels): this {
    if (amount < 0) {
      throw new Error(`Expected increment amount to be greater than -1. Received: ${amount}`);
    }
    const metric = this.get(labels);
    this.set(metric ? metric.value + amount : amount, labels);

    return this;
  }

  reset(labels?: Labels): void {
    this.set(0, labels);
  }
}
