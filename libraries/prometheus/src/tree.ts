export class TreeNode<T = any> {
  mapKeyToChild = new Map<string, TreeNode>();
  children: TreeNode[] = [];
  parent: TreeNode | null = null;
  /**
   * 父节点中对应自己的键
   */
  key: string | null = null;
  /**
   * 叶子节点直接用这个字段存储值，从而屏蔽掉 children 数组的开销
   * 非叶子节点则不主动设置这个字段
   */
  private value: T | null = null;

  private _cached: string | null = null;

  serialize(): string {
    return (this._cached ??=
      this.children.length === 0
        ? this.value !== null
          ? `${this.value}`
          : ''
        : this.children.map((x) => x.serialize()).join(''));
  }

  getChild<T>(key: string): TreeNode<T> {
    let child = this.mapKeyToChild.get(key);
    if (!child) {
      child = new TreeNode<T>();
      child.parent = this;
      child.key = key;
      this.mapKeyToChild.set(key, child);
      this.children.push(child);
    }
    return child;
  }

  invalidateAncestors() {
    for (let ptr = this.parent; ptr; ptr = ptr.parent) {
      //   if (ptr._cached === null) break; // already invalidated
      ptr._cached = null;
    }
  }

  getValue(): T | null {
    return this.value;
  }

  setValue(value: T) {
    if (this.value !== value) {
      this.invalidateAncestors();
      this.value = value;
    }
  }

  removeChild(key: string) {
    const child = this.mapKeyToChild.get(key);
    if (child) {
      // detach child from parent
      child.parent = null;
      this.mapKeyToChild.delete(key);
      this.children.splice(this.children.indexOf(child), 1);

      this.invalidateAncestors();
      this.value = null;
    }
  }

  remove() {
    if (!this.parent) throw new Error('Cannot remove root node');
    if (!this.key) throw new Error('Node key is null'); // should not happen
    this.parent.removeChild(this.key);
  }
}
