import {
  IQuoteUpdateAction as IExchangeQuoteUpdateAction,
  IQuoteServiceRequestByVEX,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { newError } from '@yuants/utils';
import { filter, firstValueFrom, map } from 'rxjs';
import { IQuoteProviderInstance } from '../types';
import { IPlannedRequestWithKey } from './router';

type IPlannedRequest = IPlannedRequestWithKey['planned'];

const createConcurrencyLimiter = (concurrency: number) => {
  const queue: Array<() => void> = [];
  let active = 0;
  const next = () => {
    if (active >= concurrency) return;
    const task = queue.shift();
    if (!task) return;
    active++;
    task();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> =>
    await new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          active--;
          next();
        }
      });
      next();
    });
};

const pickInstance = (params: {
  group_id: string;
  instances: IQuoteProviderInstance[];
  mapGroupIdToRoundRobinIndex: Map<string, number>;
}): IQuoteProviderInstance => {
  const { group_id, instances, mapGroupIdToRoundRobinIndex } = params;
  if (instances.length === 0) throw newError('VEX_QUOTE_PROVIDER_INSTANCE_EMPTY', { group_id });
  const nextIndex = (mapGroupIdToRoundRobinIndex.get(group_id) ?? 0) % instances.length;
  mapGroupIdToRoundRobinIndex.set(group_id, nextIndex + 1);
  return instances[nextIndex];
};

const requestGetQuotes = async (params: {
  terminal: Terminal;
  instance: IQuoteProviderInstance;
  req: IQuoteServiceRequestByVEX;
}): Promise<IExchangeQuoteUpdateAction> => {
  const { terminal, instance, req } = params;
  const res = await firstValueFrom(
    terminal.client
      .request<IQuoteServiceRequestByVEX, IExchangeQuoteUpdateAction>(
        'GetQuotes',
        instance.terminal_id,
        req,
        instance.service_id,
      )
      .pipe(
        map((msg) => msg.res),
        filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
      ),
  );
  if (res.code !== 0) throw newError('VEX_QUOTE_PROVIDER_ERROR', { instance, res });
  if (res.data === undefined) throw newError('VEX_QUOTE_PROVIDER_DATA_MISSING', { instance, res });
  return res.data as any;
};

const runWithProviderGroupConcurrencyLimit1 = async <T>(params: {
  group_id: string;
  mapGroupIdToTailPromise: Map<string, Promise<void>>;
  fn: () => Promise<T>;
}): Promise<T> => {
  const { group_id, mapGroupIdToTailPromise, fn } = params;
  const prev = mapGroupIdToTailPromise.get(group_id) ?? Promise.resolve();
  let resolveCurrent: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });
  mapGroupIdToTailPromise.set(
    group_id,
    prev.then(() => current),
  );
  await prev;
  try {
    return await fn();
  } finally {
    resolveCurrent();
  }
};

export interface IGetQuotesExecutor {
  execute: (requests: IPlannedRequestWithKey[]) => Promise<IExchangeQuoteUpdateAction[]>;
}

export const createGetQuotesExecutor = (terminal: Terminal): IGetQuotesExecutor => {
  const mapGroupIdToRoundRobinIndex = new Map<string, number>();
  const mapGroupIdToTailPromise = new Map<string, Promise<void>>();
  const limitGetQuotes = createConcurrencyLimiter(32);

  const mapKeyToInFlightGetQuotesPromise = new Map<string, Promise<IExchangeQuoteUpdateAction>>();
  const requestGetQuotesInFlight = (key: string, planned: IPlannedRequest) => {
    const existing = mapKeyToInFlightGetQuotesPromise.get(key);
    if (existing) return existing;
    const promise = limitGetQuotes(() =>
      runWithProviderGroupConcurrencyLimit1({
        group_id: planned.group_id,
        mapGroupIdToTailPromise,
        fn: async () => {
          const instance = pickInstance({
            group_id: planned.group_id,
            instances: planned.instances,
            mapGroupIdToRoundRobinIndex,
          });
          return await requestGetQuotes({ terminal, instance, req: planned.req });
        },
      }),
    ).finally(() => {
      mapKeyToInFlightGetQuotesPromise.delete(key);
    });
    mapKeyToInFlightGetQuotesPromise.set(key, promise);
    return promise;
  };

  return {
    execute: async (requests) =>
      await Promise.all(
        requests.map(async ({ key, planned }) => await requestGetQuotesInFlight(key, planned)),
      ),
  };
};
