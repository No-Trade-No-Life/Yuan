type QueueTask = {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

interface IRateLimitQueue {
  tasks: QueueTask[];
  timer: NodeJS.Timeout;
  limit: number;
}

export class RateLimiter {
  private queues = new Map<string, IRateLimitQueue>();

  schedule<T>(key: string, limit: number, periodMs: number, execute: () => Promise<T>): Promise<T> {
    if (!Number.isFinite(limit) || limit <= 0) {
      return execute();
    }
    if (!this.queues.has(key)) {
      const timer = setInterval(() => this.process(key), periodMs);
      this.queues.set(key, {
        tasks: [],
        timer,
        limit,
      });
    }

    const queue = this.queues.get(key)!;
    return new Promise<T>((resolve, reject) => {
      queue.tasks.push({
        execute: () => execute(),
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  private process(key: string): void {
    const queue = this.queues.get(key);
    if (!queue) return;
    const tasks = queue.tasks.splice(0, queue.limit);
    tasks.forEach((task) => {
      task
        .execute()
        .then((value) => task.resolve(value))
        .catch((error) => task.reject(error));
    });
    if (queue.tasks.length === 0) {
      clearInterval(queue.timer);
      this.queues.delete(key);
    }
  }
}

export const rateLimiter = new RateLimiter();
