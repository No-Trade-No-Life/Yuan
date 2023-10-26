import { PromRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { BasicUnit } from '../BasicUnit';

// TODO: why not make it a counter?
const MetricKernelFrames = PromRegistry.create('gauge', 'kernel_frames', 'kernel frames');
/**
 * @public
 */
export class KernelFramesMetricsUnit extends BasicUnit {
  constructor(public kernel: Kernel) {
    super(kernel);
  }

  frameCnt: number = 0;

  onEvent(): void | Promise<void> {
    this.frameCnt++;
    MetricKernelFrames.set(this.frameCnt, { kernel_id: this.kernel.id });
  }
}
