export const useAsyncThrottler = <T, K>(
  asyncFunction: (params: T) => Promise<K>,
  concurrencyLimit: number,
) => {
  const queue: Array<Function> = []; // 任务队列
  let activeTasks = 0; // 当前正在执行的任务数量
  const _next = () => {
    if (queue.length === 0 || activeTasks >= concurrencyLimit) {
      return; // 队列为空或达到并发限制，直接返回
    }
    // 从队列中取出任务并执行
    const task = queue.shift();
    activeTasks++;
    task?.();
  };
  return (innerParams: T): Promise<K> => {
    return new Promise((resolve, reject) => {
      // 将任务包装成一个可执行的函数
      const task = async () => {
        try {
          const result = await asyncFunction(innerParams); // 调用异步函数
          resolve(result); // 任务成功，返回结果
        } catch (error) {
          reject(error); // 任务失败，返回错误
        } finally {
          activeTasks--; // 任务完成，减少活跃任务数
          _next(); // 执行下一个任务
        }
      };

      // 将任务加入队列
      queue.push(task);

      // 如果当前活跃任务数未达到限制，立即执行任务
      if (activeTasks < concurrencyLimit) {
        _next();
      }
    });
  };
};
