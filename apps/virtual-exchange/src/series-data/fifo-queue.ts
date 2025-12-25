export interface IQueue<T> {
  enqueue: (value: T) => void;
  dequeue: () => T | undefined;
  size: () => number;
  snapshot: (limit?: number) => T[];
}

export const createFifoQueue = <T>(): IQueue<T> => {
  let items: T[] = [];
  let head = 0;

  return {
    enqueue: (value) => {
      items.push(value);
    },
    dequeue: () => {
      if (head >= items.length) return undefined;
      const value = items[head++];
      if (head > 1024 && head * 2 > items.length) {
        items = items.slice(head);
        head = 0;
      }
      return value;
    },
    size: () => items.length - head,
    snapshot: (limit = 20) => {
      const safeLimit = Math.max(0, Math.floor(limit));
      return items.slice(head, head + safeLimit);
    },
  };
};
