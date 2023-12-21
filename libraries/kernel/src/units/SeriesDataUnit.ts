import { UUID } from '@yuants/data-model';
import { BasicUnit } from './BasicUnit';

/**
 * 序列
 * @public
 */
export class Series extends Array<number> {
  /**
   * 序列 UUID
   */
  series_id = UUID();
  /**
   * 序列名称 (可重复)
   */
  name: string | undefined;
  /**
   * 序列的父级序列
   *
   * 序列的父序列
   * 1. 序列的额外属性(tags)在 解释阶段 继承自 父序列
   * 2. 序列可以覆盖父序列的额外属性(tags)
   *
   * undefined - 顶级序列 (用于表达时间的 Timestamp Series)
   *
   */
  parent: Series | undefined;
  /** 额外属性 */
  tags: Record<string, any> = {};

  private _root: Series | undefined;

  /** 解释属性值 */
  resolveValue(tagName: string) {
    return this.findParentWard((series) => series.tags[tagName] !== undefined)?.tags[tagName];
  }

  get currentIndex() {
    return this.resolveRoot().length - 1;
  }

  get previousIndex() {
    return this.resolveRoot().length - 2;
  }

  get currentValue() {
    return this[this.currentIndex];
  }

  get previousValue() {
    return this[this.previousIndex];
  }

  /**
   * 获取根节点序列
   */
  resolveRoot(): Series {
    return (this._root ??= this.parent ? this.parent.resolveRoot() : this);
  }

  /**
   * 向上查找满足条件的序列
   * @param predicate - 条件
   */
  findParentWard(predicate: (series: Series) => any): Series | undefined {
    let ptr: Series | undefined = this;
    while (ptr) {
      if (predicate(ptr)) {
        return ptr;
      }
      ptr = ptr.parent;
    }
    return undefined;
  }
}

/**
 * 时间序列数据单元
 * @public
 */
export class SeriesDataUnit extends BasicUnit {
  series: Series[] = [];

  dump() {
    return {
      series: this.series,
    };
  }

  restore(state: any): void {
    this.series = state.series;
  }
}
