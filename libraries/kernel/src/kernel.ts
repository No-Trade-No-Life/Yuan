import { PriorityQueue } from '@datastructures-js/priority-queue';
import { formatTime, UUID } from '@yuants/utils';
import { firstValueFrom, Observable, Subject } from 'rxjs';

/**
 * 内核功能单元
 * @public
 */
export interface IKernelUnit {
  /**
   * 内核
   */
  kernel: Kernel;
  /**
   * 当内核初始化时调用
   */
  onInit(): void | Promise<void>;
  /**
   * 当内核事件发生时调用
   */
  onEvent(): void | Promise<void>;
  /**
   * 当内核空闲时调用
   *
   * 如果没有新的事件，内核将被销毁
   */
  onIdle(): void | Promise<void>;
  /**
   * 内核将被销毁时调用
   */
  onDispose(): void | Promise<void>;

  /**
   * dump state from unit
   */
  dump(): any;
  /**
   * restore state
   */
  restore(state: any): void;
}

/**
 * 内核
 *
 * - 实现流批一体调度
 * - 按照时间戳顺序调度 (不允许出现时间倒流)
 *
 * @public
 */
export class Kernel {
  constructor(public id: string = UUID()) {}
  private eventCnt: number = 0;
  private queue = new PriorityQueue<number>(
    (a, b) => this.mapIdToTimestamp.get(a)! - this.mapIdToTimestamp.get(b)!,
  );

  private _alloc$ = new Subject<void>();

  private mapIdToTimestamp = new Map<number, number>();
  /** 当前处理的事件编号 */
  currentEventId: number = -1;
  /** 当前处理的事件时间戳 */
  currentTimestamp: number = -Infinity;
  /**
   * 分配一个事件
   *
   * @param timestamp - 事件(将要)发生的时间戳
   * @returns id - 返回的事件 ID
   */
  alloc(timestamp: number): number {
    const id = this.eventCnt++;
    this.mapIdToTimestamp.set(id, timestamp);
    this.queue.enqueue(id);
    this._alloc$.next();
    return id;
  }
  /**
   * 添加一个单元
   */
  addUnit(unit: IKernelUnit): void {
    this.units.push(unit);
  }
  /**
   * 单元列表
   */
  units: IKernelUnit[] = [];

  private _dispose$ = new Subject<void>();

  dispose$: Observable<void> = this._dispose$.asObservable();

  /**
   * 内核状态
   */
  status: 'created' | 'initializing' | 'running' | 'terminating' | 'terminated' | 'idle' = 'created';

  /**
   * 时序错误次数
   */
  chronologicErrors = 0;

  private isTerminating = false;

  /**
   * 开始运行
   */
  async start() {
    Object.freeze(this.units);
    this.status = 'initializing';
    // 初始化
    for (const unit of this.units) {
      const ret = unit.onInit();
      if (ret instanceof Promise) {
        await ret;
      }
    }
    while (true) {
      this.status = 'running';
      // Flush Queue
      while (this.queue.size() > 0) {
        if (this.isTerminating) break;

        const id = this.queue.dequeue();
        if (id === null) continue;
        const timestamp = this.mapIdToTimestamp.get(id)!;
        this.mapIdToTimestamp.delete(id);
        if (timestamp === Infinity) {
          // Terminate kernel
          this.terminate();
          break;
        }
        if (this.currentTimestamp > timestamp) {
          // 时间倒流发生，丢弃事件
          // Kernel 不应当假设一定会被上报，由上层功能单元负责读取数据并上报
          this.chronologicErrors++;
          console.info(
            formatTime(Date.now()),
            `Kernel ${this.id} 时序错误: 事件ID=${id} 事件时间=${formatTime(
              timestamp,
            )} < 当前事件时间=${formatTime(this.currentTimestamp)}`,
          );
          continue;
        }
        this.currentEventId = id;
        this.currentTimestamp = timestamp;
        for (const unit of this.units) {
          const ret = unit.onEvent();
          if (ret instanceof Promise) {
            await ret;
          }
        }
      }

      if (this.isTerminating) break;

      // Request Idle
      this.status = 'idle';
      for (const unit of this.units) {
        unit.onIdle();
      }
      // Wait until new event allocated
      await firstValueFrom(this._alloc$);
    }
    this.status = 'terminating';
    // Dispose
    for (const unit of this.units) {
      const ret = unit.onDispose();
      if (ret instanceof Promise) {
        await ret;
      }
    }
    this._dispose$.next();
    this.status = 'terminated';
  }

  /** 终止内核 */
  terminate() {
    this.isTerminating = true;
  }

  /**
   * 可覆盖的日志函数，如果 undefined 就不会输出日志
   */
  log: ((...params: any[]) => void) | undefined = (...params: any[]) => {
    console.info(`#${this.currentEventId}`, formatTime(this.currentTimestamp), ...params);
  };

  dump = () => {
    return {
      kernel: {
        id: this.id,
        eventCnt: this.eventCnt,
        currentEventId: this.currentEventId,
        currentTimestamp: this.currentTimestamp,
        status: this.status,
        isTerminating: this.isTerminating,
        queue: this.queue.toArray().map((id) => [id, this.mapIdToTimestamp.get(id)!]),
      },
      units: this.units.map((unit) => unit.dump()),
    };
  };

  restore = (state: any) => {
    this.id = state.kernel.id;
    this.eventCnt = state.kernel.eventCnt;
    this.currentEventId = state.kernel.currentEventId;
    this.currentTimestamp = state.kernel.currentTimestamp;
    this.status = state.kernel.status;
    this.isTerminating = state.kernel.isTerminating;
    this.queue.clear();
    state.kernel.queue.forEach(([id, t]: [number, number]) => {
      this.queue.enqueue(id);
      this.mapIdToTimestamp.set(id, t);
    });
    this.units.forEach((unit, idx) => {
      unit.restore(state.units[idx]);
    });
  };

  findUnit<T extends IKernelUnit>(Unit: new (...args: any[]) => T): T | undefined {
    return this.units.find((v): v is T => v instanceof Unit);
  }

  findUnits<T extends IKernelUnit>(Unit: new (...args: any[]) => T) {
    return this.units.filter((v): v is T => v instanceof Unit);
  }
}
