import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';

/**
 * 基本文件系统单元
 *
 * @public
 */
export class BasicFileSystemUnit extends BasicUnit {
  constructor(public kernel: Kernel) {
    super(kernel);
  }

  dump() {
    return {};
  }

  restore(state: any): void {}

  onInit(): void | Promise<void> {}

  onEvent(): void | Promise<void> {}

  onIdle(): void | Promise<void> {}

  readFile(filename: string): Promise<string | null> {
    throw new Error('readFile method not implemented');
  }

  writeFile(filename: string, content: string): Promise<void> {
    throw new Error('writeFile method not implemented');
  }
}
