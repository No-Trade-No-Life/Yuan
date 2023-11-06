import { IKernelUnit, Kernel } from '../kernel';

/**
 * 基础单元
 *
 * - 自动注册到内核
 * - 不处理任何逻辑
 *
 * @public
 */
export class BasicUnit implements IKernelUnit {
  constructor(public kernel: Kernel) {
    kernel.addUnit(this);
  }
  dump() {
    return {};
  }
  restore(state: any): void {}
  onInit(): void | Promise<void> {}
  onEvent(): void | Promise<void> {}
  onIdle(): void | Promise<void> {}
  onDispose(): void | Promise<void> {}
}
