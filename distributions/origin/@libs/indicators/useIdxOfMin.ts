/**
 * 计算滑动窗口最小值所在的索引 (Rolling Min Index)
 *
 * 利用了单调队列，均摊时间复杂度为 O(n)
 *
 * @param source 输入数据源
 * @param period 周期 (>0)
 *
 */
export const useRollingMinIndex = (source: Series, period: number) => {
  const iMIN = useSeries(`RollingMinIndex(${source.name},${period})`, source, {
    // display: "index",
  });
  // 单调队列: 保存当前窗口期内，比最新的元素小的元素的索引
  const queue = useRef<number[]>([]).current;
  useEffect(() => {
    const i = source.length - 2;
    if (i < 0) return;
    // 从栈顶开始，移除所有大于固定值的元素
    while (queue.length > 0 && source[queue[queue.length - 1]] >= source[i]) {
      queue.pop();
    }
    // 将当前值入栈
    queue.push(i);
    // 移除超出窗口期的元素 (通常一次只会移除一个)
    while (queue.length > 0 && queue[0] <= i - period) {
      queue.shift();
    }
  }, [source.length]);
  useEffect(() => {
    const i = source.length - 1;
    if (i < 0) return;
    // 最小元素候选: 队首元素、当前元素
    iMIN[i] = i; // 当前元素
    if (queue.length > 0) {
      if (source[queue[0]] < source[iMIN[i]]) {
        iMIN[i] = queue[0];
      }
    }
  });
  return iMIN;
};
