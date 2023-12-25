import { BasicUnit } from './BasicUnit';

/**
 * Terminate Unit
 *
 * If exists, terminate the kernel after all events are processed.
 *
 * @public
 */
export class TerminateUnit extends BasicUnit {
  onInit() {
    this.kernel.alloc(Infinity);
  }
}
