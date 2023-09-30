import { UUID } from '@yuants/data-model';
import { IOrder, IPosition, IProduct, OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import { Series } from '../SeriesDataUnit';
import { ScriptUnit } from './ScriptUnit';
import { ScriptNode } from './script-node';

export const _statusStack: string[] = [];
const isMounting = () => _statusStack[_statusStack.length - 1] === 'MOUNT';

export const _nodeStack: ScriptNode[] = [];
const currentNode = () => _nodeStack[_nodeStack.length - 1]!;

interface IHookNode {
  value?: any;
}

const createNewHook = () => {
  const node = currentNode();
  const hook: IHookNode = {};
  node._hooks.push(hook);
  return hook;
};

const getHook = () => {
  const node = currentNode();
  const hook = node._hooks[node._hookIdx];
  node._hookIdx = (node._hookIdx + 1) % node._hooks.length;
  return hook;
};

export const useScriptNode = (): ScriptNode => {
  return currentNode();
};

export const useRef = <T>(initial_value: T): { current: T } => {
  if (isMounting()) {
    const hook = createNewHook();
    hook.value = { current: initial_value };
    return hook.value;
  }
  return getHook().value;
};

export const useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  // NOTE: 与 React Hook 不同的是，会立即执行 Effect
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
    theRef.current.cleanup?.();
    theRef.current.cleanup = fn() || undefined;
    theRef.current.deps = deps;
  }
};

export const useMemo = <T>(fn: () => T, deps: any[]): T => {
  const theValue = useRef<T | undefined>(undefined);
  useEffect(() => {
    theValue.current = fn();
  }, deps);
  return theValue.current!;
};

export const useShell = (): ScriptUnit => {
  const node = useScriptNode();
  return node.shell;
};

export const useAccountInfo = () => {
  const shell = useShell();
  return shell.accountInfoUnit.accountInfo;
};

const useSeries = (name: string, tags: Record<string, any>, parent?: Series): Series => {
  const node = useScriptNode();
  return useMemo(() => {
    const series = new Series();
    series.name = name;
    series.tags = tags;
    series.parent = parent;
    node.shell.seriesDataUnit.series.push(series);
    return series;
  }, []);
};

/**
 * @public
 */
export interface OutputSeriesOptions {
  type?: 'Line' | 'Area' | 'Histogram' | 'Baseline';
  panel?: 'main' | 'auxiliary';
  color?: 'string';
  parent?: Series;
}

export const useRecordTable = (name: string) => {
  const shell = useShell();
  return (shell.record_table[name] ??= []);
};

export const useOutputSeries = (name: string, options: OutputSeriesOptions = {}) => {
  const node = useScriptNode();
  return useSeries(name, { name, type: 'output', options, node_id: node.id }, options.parent);
};

export const useScript = (uri: string, params: any): Series[] => {
  const node = useScriptNode();
  const childRef = useRef(new ScriptNode(node.shell, uri, node.resolved_path, params));
  if (isMounting()) {
    node.children.push(childRef.current);
    // 先返回一个假的，因为此时 ScriptNode 内部还未申请好
    return new Proxy([], {
      get: (target: Series[], p) => {
        if (p === Symbol.iterator) {
          // 在迭代时自动申请内部数组
          return function* () {
            for (let i = 0; i < 1e5; i++) {
              yield (target[i] ??= new Series());
            }
          };
        }
      },
    });
  } else {
    childRef.current.scriptConf = params;
    childRef.current.update();
    return node.shell.seriesDataUnit.series.filter((series) => series.tags.node_id === childRef.current.id);
  }
};

export const useState = <T>(initState: T): [T, (v: T) => void] => {
  const ref = useRef(initState);
  const shell = useShell();
  const update = (state: T) => {
    if (state !== ref.current) {
      ref.current = state;
      // ISSUE: 重新入队以重新执行
      shell.kernel.alloc(shell.kernel.currentTimestamp);
    }
  };
  return [ref.current, update];
};

export const useInfo = () => {};
export const useUpdate = (fn: () => void) => useEffect(fn);

export const useLog = () => {
  const shell = useShell();
  const kernel = shell.kernel;
  return kernel.log || (() => {});
};

export const useParamString = (key: string, defaultValue = ''): string => {
  const node = useScriptNode();

  useEffect(() => {
    node._paramsSchema.properties![key] = { type: 'string', default: defaultValue };
  }, []);
  return node.scriptConf[key] ?? defaultValue;
};

export const useParamNumber = (key: string, defaultValue = 0): number => {
  const node = useScriptNode();
  useEffect(() => {
    node._paramsSchema.properties![key] = { type: 'number', default: defaultValue };
  }, []);
  return node.scriptConf[key] ?? defaultValue;
};

export const useParamBoolean = (key: string, defaultValue = false): boolean => {
  const node = useScriptNode();
  useEffect(() => {
    node._paramsSchema.properties![key] = { type: 'boolean', default: defaultValue };
  }, []);
  return node.scriptConf[key] ?? defaultValue;
};

export const useParamSeries = (key: string): number[] => {
  const node = useScriptNode();
  return node.scriptConf[key] ?? [];
};

export const usePeriod = (
  datasource_id: string,
  product_id: string,
  period_in_sec: number,
): [number, Series, Series, Series, Series, Series, Series] => {
  const shell = useShell();
  const key = [datasource_id, product_id, period_in_sec].join(); // TODO: Memoize Key

  const time = useSeries(`T(${key})`, {
    type: 'period',
    subType: 'timestamp_in_us',
    datasource_id,
    product_id,
    period_in_sec,
  });
  const open = useSeries(`O(${key})`, {}, time);
  const high = useSeries(`H(${key})`, {}, time);
  const low = useSeries(`L(${key})`, {}, time);
  const close = useSeries(`C(${key})`, {}, time);
  const volume = useSeries(`VOL(${key})`, {}, time);

  useEffect(() => {
    shell.productLoadingUnit?.productTasks.push({
      datasource_id,
      product_id,
    });
    shell.periodLoadingUnit?.periodTasks.push({
      datasource_id,
      product_id,
      period_in_sec,
      start_time_in_us: shell.options.start_time * 1000,
      end_time_in_us: shell.options.end_time * 1000,
    });
  }, []);

  const periods = shell.periodDataUnit.data[key] ?? [];
  const idx = periods.length - 1;

  useEffect(() => {
    const period = periods[idx];
    if (period) {
      time[idx] = period.timestamp_in_us;
      open[idx] = period.open;
      high[idx] = period.high;
      low[idx] = period.low;
      close[idx] = period.close;
      volume[idx] = period.volume;
    }
  });

  return [idx, time, open, high, low, close, volume];
};

export const useSinglePosition = (
  product_id: string,
  variant: PositionVariant,
): {
  targetVolume: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  setTargetVolume: (v: number) => void;
  setTakeProfitPrice: (v: number) => void;
  setStopLossPrice: (v: number) => void;
} & IPosition => {
  const position_id = useRef(UUID()).current;
  const shell = useShell();
  const position = shell.accountInfoUnit.getPosition(position_id, product_id, variant);
  const stopLossOrderRef = useRef<IOrder | null>(null);
  const takeProfitOrderRef = useRef<IOrder | null>(null);

  const productRef = useRef<IProduct | null>(null);
  useEffect(() => {
    productRef.current = shell.productDataUnit.mapProductIdToProduct[product_id] ?? null;
  }, [Object.values(shell.productDataUnit.mapProductIdToProduct).length]);

  const volume_step = productRef.current?.volume_step ?? 1e-9;

  const [targetVolume, setTargetVolume] = useState(0);
  const [stopLossPrice, setStopLossPrice] = useState(0);
  const [takeProfitPrice, setTakeProfitPrice] = useState(0);

  useEffect(() => {
    if (takeProfitOrderRef.current?.traded_volume) {
      setTargetVolume(targetVolume - takeProfitOrderRef.current.traded_volume);
    }
  }, [takeProfitOrderRef.current?.traded_volume]);

  useEffect(() => {
    if (stopLossOrderRef.current?.traded_volume) {
      setTargetVolume(targetVolume - stopLossOrderRef.current.traded_volume);
    }
  }, [stopLossOrderRef.current?.traded_volume]);

  useEffect(() => {
    if (targetVolume >= 0) {
      if (targetVolume > position.volume) {
        const volume = roundToStep(targetVolume - position.volume, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          client_order_id: UUID(),
          account_id: shell.accountInfoUnit.accountInfo.account_id,
          product_id: position.product_id,
          position_id: position.position_id,
          type: OrderType.MARKET,
          direction:
            position.variant === PositionVariant.LONG ? OrderDirection.OPEN_LONG : OrderDirection.OPEN_SHORT,
          volume: roundToStep(targetVolume - position.volume, volume_step),
        };
        shell.orderMatchingUnit.submitOrder(order);
        return () => {
          shell.orderMatchingUnit.cancelOrder(order.client_order_id);
        };
      }
      if (targetVolume < position.volume) {
        const volume = roundToStep(position.volume - targetVolume, volume_step);
        if (volume === 0) {
          return;
        }
        const order: IOrder = {
          client_order_id: UUID(),
          account_id: shell.accountInfoUnit.accountInfo.account_id,
          product_id: position.product_id,
          position_id: position.position_id,
          type: OrderType.MARKET,
          direction:
            position.variant === PositionVariant.LONG
              ? OrderDirection.CLOSE_LONG
              : OrderDirection.CLOSE_SHORT,
          volume,
        };
        if (order.volume) shell.orderMatchingUnit.submitOrder(order);
        return () => {
          shell.orderMatchingUnit.cancelOrder(order.client_order_id);
        };
      }
    }
  }, [targetVolume, position.volume]);

  useEffect(() => {
    if (takeProfitPrice && position.volume) {
      const order: IOrder = {
        client_order_id: UUID(),
        account_id: shell.accountInfoUnit.accountInfo.account_id,
        product_id,
        position_id,
        type: OrderType.LIMIT,
        direction:
          position.variant === PositionVariant.LONG ? OrderDirection.CLOSE_LONG : OrderDirection.CLOSE_SHORT,
        price: takeProfitPrice,
        volume: position.volume,
      };
      takeProfitOrderRef.current = order;
      shell.orderMatchingUnit.submitOrder(order);
      return () => {
        // 撤单
        takeProfitOrderRef.current = null;
        shell.orderMatchingUnit.cancelOrder(order.client_order_id);
      };
    }
  }, [takeProfitPrice, position.volume]);

  useEffect(() => {
    if (stopLossPrice && position.volume) {
      const order: IOrder = {
        client_order_id: UUID(),
        account_id: shell.accountInfoUnit.accountInfo.account_id,
        product_id,
        position_id,
        type: OrderType.STOP,
        direction:
          position.variant === PositionVariant.LONG ? OrderDirection.CLOSE_LONG : OrderDirection.CLOSE_SHORT,
        price: stopLossPrice,
        volume: position.volume,
      };
      stopLossOrderRef.current = order;
      shell.orderMatchingUnit.submitOrder(order);
      return () => {
        // 撤单
        stopLossOrderRef.current = null;
        shell.orderMatchingUnit.cancelOrder(order.client_order_id);
      };
    }
  }, [stopLossPrice, position.volume]);

  return {
    ...position,
    targetVolume: targetVolume,
    takeProfitPrice: takeProfitPrice,
    stopLossPrice: stopLossPrice,
    setTargetVolume,
    setTakeProfitPrice,
    setStopLossPrice,
  };
};

export const useExchange = (): {
  listOrders: () => IOrder[];
  submitOrder: (...orders: IOrder[]) => void;
  cancelOrder: (...orderIds: string[]) => void;
} => {
  const shell = useShell();
  return {
    listOrders: () => {
      return shell.orderMatchingUnit.listOrders();
    },
    submitOrder: (...orders) => {
      shell.orderMatchingUnit.submitOrder(...orders);
    },
    cancelOrder: (...orderIds) => {
      shell.orderMatchingUnit.cancelOrder(...orderIds);
    },
  };
};
