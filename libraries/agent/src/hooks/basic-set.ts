import { AgentUnit } from '../AgentUnit';

/**
 * 使用 Agent 自身的上下文
 * @public
 */
export const useAgent = (): AgentUnit => AgentUnit.currentAgent!;

/**
 * 使用变量引用，在模型的生命周期内保持对同一变量的引用
 * @param initial_value - 初始值
 * @returns 变量引用
 * @public
 */
export const useRef = <T>(initial_value: T): { current: T } => useAgent()?.useRef(initial_value);

/**
 * 使用副作用，会在依赖项变更时执行副作用函数
 *
 * 当判断需要执行副作用函数时会立即执行副作用，这个行为与 React.useEffect 有区别
 * @param fn - 副作用函数
 * @param deps - 依赖项
 * @public
 */
export const useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  const theRef = useRef({
    deps: undefined as any[] | undefined,
    cleanup: undefined as (() => void) | undefined,
  });

  if (
    deps === undefined ||
    theRef.current.deps === undefined ||
    theRef.current.deps.length !== deps.length ||
    theRef.current.deps.some((v, i) => v !== deps[i])
  ) {
    const cleanups = AgentUnit.currentAgent!.cleanups;
    const currentCleanUp = theRef.current.cleanup;
    if (currentCleanUp && cleanups.has(currentCleanUp)) {
      cleanups.delete(currentCleanUp);
      currentCleanUp();
    }
    const nextCleanUp = (theRef.current.cleanup = fn() || undefined);
    if (nextCleanUp) {
      cleanups.add(nextCleanUp);
    }
    theRef.current.deps = deps;
  }
};

/**
 * 使用记忆化，会在依赖项变更时重新计算值，需要被调用函数是异步的
 *
 * @param fn - 异步计算函数
 * @param deps - 依赖项
 * @returns 异步计算结果
 * @public
 */
export const useMemoAsync = async <T>(fn: () => Promise<T>, deps?: any[]): Promise<T> => {
  const theRef = useRef({
    deps: undefined as any[] | undefined,
    value: undefined as T | undefined,
  });

  if (
    deps === undefined ||
    theRef.current.deps === undefined ||
    theRef.current.deps.length !== deps.length ||
    theRef.current.deps.some((v, i) => v !== deps[i])
  ) {
    theRef.current.value = await fn();
    theRef.current.deps = deps;
  }
  return theRef.current.value!;
};

/**
 * 使用记忆化，会在依赖项变更时重新计算值
 *
 * @param fn - 计算函数
 * @param deps - 依赖项
 * @returns fn 的返回值
 * @public
 */
export const useMemo = <T>(fn: () => T, deps: any[]): T => {
  const theValue = useRef<T | undefined>(undefined);
  useEffect(() => {
    theValue.current = fn();
  }, deps);
  return theValue.current!;
};

/**
 * 使用状态，会在状态变更时要求 Agent 重新评估
 *
 * @param initState - 初始状态
 * @returns [state, setState] 状态和更新函数
 * @public
 */
export const useState = <T>(initState: T): [T, (v: T) => void] => {
  const ref = useRef(initState);
  const agent = useAgent();
  const setState = (state: T) => {
    if (state !== ref.current) {
      ref.current = state;
      // TODO: add batch update like React does
      agent.kernel.alloc(agent.kernel.currentTimestamp);
    }
  };
  return [ref.current, setState];
};
