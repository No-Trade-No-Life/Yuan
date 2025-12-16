import {
  IQuoteUpdateAction as IExchangeQuoteUpdateAction,
  IQuoteServiceRequestByVEX,
  parseQuoteServiceMetadataFromSchema,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime, newError } from '@yuants/utils';
import { filter, firstValueFrom, map } from 'rxjs';
import { createSortedPrefixMatcher } from './prefix-matcher';
import { fnv1a64HexFromStrings } from './request-key';
import { IQuoteKey, IQuoteState, IQuoteUpdateAction } from './types';

export interface IQuoteMiss {
  product_id: string;
  field: IQuoteKey;
}

// -----------------------------------------------------------------------------
// Provider discovery (schema-driven)
// -----------------------------------------------------------------------------

interface IQuoteProviderInstance {
  terminal_id: string;
  service_id: string;
}

/**
 * A "provider group" is a capability signature of `GetQuotes`.
 * Multiple vendor terminals may provide the same capability; VEX load-balances across instances.
 */
interface IQuoteProviderGroup {
  group_id: string;
  product_id_prefix: string;
  fields: IQuoteKey[];
  max_products_per_request?: number;
  instances: IQuoteProviderInstance[];
}

type IPlannedRequest = {
  group_id: string;
  instances: IQuoteProviderInstance[];
  req: IQuoteServiceRequestByVEX;
};

/**
 * Build provider groups from runtime terminal infos.
 *
 * Note: `fields` is schema `const`, so VEX must keep a stable order (lexicographical sort).
 */
const discoverProviderGroups = (terminal: Terminal): IQuoteProviderGroup[] => {
  const mapGroupIdToGroup = new Map<string, IQuoteProviderGroup>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo ?? {})) {
      if (serviceInfo.method !== 'GetQuotes') continue;
      console.info(
        formatTime(Date.now()),
        `[VEX][QUOTE]DiscoveringGetQuotesProvider...`,
        `from terminal ${terminalInfo.terminal_id}`,
        `service ${serviceInfo.service_id}`,
        `schema:  ${JSON.stringify(serviceInfo.schema)}`,
      );
      try {
        const metadata = parseQuoteServiceMetadataFromSchema(serviceInfo.schema);
        const fields = [...(metadata.fields as unknown as IQuoteKey[])].sort();
        const group_id = encodePath(
          metadata.product_id_prefix,
          fields.join(','),
          metadata.max_products_per_request ?? '',
        );
        const group =
          mapGroupIdToGroup.get(group_id) ??
          (() => {
            const next: IQuoteProviderGroup = {
              group_id,
              product_id_prefix: metadata.product_id_prefix,
              fields,
              max_products_per_request: metadata.max_products_per_request,
              instances: [],
            };
            mapGroupIdToGroup.set(group_id, next);
            return next;
          })();
        group.instances.push({
          terminal_id: terminalInfo.terminal_id,
          service_id: serviceInfo.service_id || serviceInfo.method,
        });
      } catch {
        // Ignore invalid schemas/providers
        console.info(
          `[VEX][Quote] Ignored GetQuotes provider from terminal ${terminalInfo.terminal_id} `,
          `service ${serviceInfo.service_id} due to invalid schema.`,
        );
        continue;
      }
    }
  }
  return [...mapGroupIdToGroup.values()];
};

// -----------------------------------------------------------------------------
// Load balancing & upstream request execution
// -----------------------------------------------------------------------------

const mapGroupIdToRoundRobinIndex = new Map<string, number>();
const pickInstance = (group_id: string, instances: IQuoteProviderInstance[]): IQuoteProviderInstance => {
  if (instances.length === 0) throw newError('VEX_QUOTE_PROVIDER_INSTANCE_EMPTY', { group_id });
  const nextIndex = (mapGroupIdToRoundRobinIndex.get(group_id) ?? 0) % instances.length;
  mapGroupIdToRoundRobinIndex.set(group_id, nextIndex + 1);
  return instances[nextIndex];
};

/**
 * Call a specified vendor terminal + service instance.
 *
 * Any non-0 response is treated as fatal (strict freshness requirement).
 */
const requestGetQuotes = async (
  terminal: Terminal,
  instance: IQuoteProviderInstance,
  req: IQuoteServiceRequestByVEX,
): Promise<IExchangeQuoteUpdateAction> => {
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
  if (res.code !== 0) {
    throw newError('VEX_QUOTE_PROVIDER_ERROR', { instance, res });
  }
  if (res.data === undefined) {
    throw newError('VEX_QUOTE_PROVIDER_DATA_MISSING', { instance, res });
  }
  return res.data as any;
};

/**
 * Per-provider (group_id) concurrency limit: 1.
 * Implemented as a per-group promise tail.
 */
const mapGroupIdToTailPromise = new Map<string, Promise<void>>();
const runWithProviderGroupConcurrencyLimit1 = async <T>(
  group_id: string,
  fn: () => Promise<T>,
): Promise<T> => {
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

/**
 * A tiny async limiter: used as a global concurrency cap to avoid request explosions.
 */
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
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
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
};

// Global concurrency cap for upstream `GetQuotes` calls (provider-level cap is handled separately).
const limitGetQuotes = createConcurrencyLimiter(32);

/**
 * In-flight dedup:
 * Same (provider group + product batch) should share a single upstream request promise.
 */
const mapKeyToInFlightGetQuotesPromise = new Map<string, Promise<IExchangeQuoteUpdateAction>>();
const requestGetQuotesInFlight = (terminal: Terminal, key: string, planned: IPlannedRequest) => {
  const existing = mapKeyToInFlightGetQuotesPromise.get(key);
  if (existing) return existing;
  const promise = limitGetQuotes(() =>
    runWithProviderGroupConcurrencyLimit1(planned.group_id, async () => {
      const instance = pickInstance(planned.group_id, planned.instances);
      return await requestGetQuotes(terminal, instance, planned.req);
    }),
  ).finally(() => {
    mapKeyToInFlightGetQuotesPromise.delete(key);
  });
  mapKeyToInFlightGetQuotesPromise.set(key, promise);
  return promise;
};

// -----------------------------------------------------------------------------
// Routing indices (prefix + field inverted index)
// -----------------------------------------------------------------------------

type IProviderIndices = ReturnType<typeof buildProviderIndices>;

const buildProviderIndices = (groups: IQuoteProviderGroup[]) => {
  const mapGroupIdToGroup = new Map(groups.map((x) => [x.group_id, x] as const));
  const prefixMatcher = createSortedPrefixMatcher(
    groups.map((group) => ({ prefix: group.product_id_prefix, value: group.group_id })),
  );
  const mapFieldToGroupIds = new Map<IQuoteKey, Set<string>>();
  for (const group of groups) {
    for (const field of group.fields) {
      let groupIds = mapFieldToGroupIds.get(field);
      if (!groupIds) {
        groupIds = new Set<string>();
        mapFieldToGroupIds.set(field, groupIds);
      }
      groupIds.add(group.group_id);
    }
  }
  return { mapGroupIdToGroup, prefixMatcher, mapFieldToGroupIds };
};

/**
 * L1 quote routing (per `docs/zh-Hans/code-guidelines/exchange.md`):
 * For each missed (product_id, field), route to `S_product_id ∩ S_field`.
 */
const routeMisses = (
  cacheMissed: IQuoteMiss[],
  indices: IProviderIndices,
  updated_at: number,
): {
  productsByGroupId: Map<string, Set<string>>;
  unavailableAction: IQuoteUpdateAction;
  unroutableProducts: Set<string>;
} => {
  const { prefixMatcher, mapFieldToGroupIds } = indices;

  const mapProductIdToGroupIds = new Map<string, string[]>();

  const productsByGroupId = new Map<string, Set<string>>();
  const unroutableProducts = new Set<string>();
  // Field unavailable: return "" but keep updated_at satisfied to avoid repeated misses.
  const unavailableAction: IQuoteUpdateAction = {};

  for (const miss of cacheMissed) {
    const { product_id, field } = miss;

    let productGroupIds = mapProductIdToGroupIds.get(product_id);
    if (!productGroupIds) {
      productGroupIds = prefixMatcher.match(product_id);
      mapProductIdToGroupIds.set(product_id, productGroupIds);
    }
    if (productGroupIds.length === 0) {
      unroutableProducts.add(product_id);
      continue;
    }

    const fieldGroupIds = mapFieldToGroupIds.get(field);
    if (!fieldGroupIds) {
      if (!unavailableAction[product_id]) unavailableAction[product_id] = {};
      unavailableAction[product_id]![field] = ['', updated_at];
      continue;
    }

    let matched = false;
    for (const group_id of productGroupIds) {
      if (!fieldGroupIds.has(group_id)) continue;
      matched = true;
      let productIds = productsByGroupId.get(group_id);
      if (!productIds) {
        productIds = new Set<string>();
        productsByGroupId.set(group_id, productIds);
      }
      productIds.add(product_id);
    }

    if (!matched) {
      if (!unavailableAction[product_id]) unavailableAction[product_id] = {};
      unavailableAction[product_id]![field] = ['', updated_at];
    }
  }

  return { productsByGroupId, unavailableAction, unroutableProducts };
};

const createRequestKey = (group_id: string, batchProductIds: string[]) =>
  encodePath(group_id, fnv1a64HexFromStrings(batchProductIds));

const planRequests = (
  productsByGroupId: Map<string, Set<string>>,
  mapGroupIdToGroup: Map<string, IQuoteProviderGroup>,
): Array<{ key: string; planned: IPlannedRequest }> => {
  const plannedRequests: Array<{ key: string; planned: IPlannedRequest }> = [];
  for (const [group_id, productIdSet] of productsByGroupId) {
    const group = mapGroupIdToGroup.get(group_id);
    if (!group) continue;
    const sortedProductIds = [...productIdSet].sort();
    const max = group.max_products_per_request ?? sortedProductIds.length;
    for (let i = 0; i < sortedProductIds.length; i += max) {
      const batchProductIds = sortedProductIds.slice(i, i + max);
      const key = createRequestKey(group_id, batchProductIds);
      plannedRequests.push({
        key,
        planned: {
          group_id,
          instances: group.instances,
          req: { product_ids: batchProductIds, fields: group.fields as any },
        },
      });
    }
  }
  return plannedRequests;
};

export const fillQuoteStateFromUpstream = async (params: {
  terminal: Terminal;
  quoteState: IQuoteState;
  cacheMissed: IQuoteMiss[];
  updated_at: number;
}): Promise<void> => {
  const { terminal, quoteState, cacheMissed, updated_at } = params;
  if (cacheMissed.length === 0) return;

  const providerGroups = discoverProviderGroups(terminal);
  console.info(
    formatTime(Date.now()),
    `[VEX][Quote]UpstreamProviderDiscovery`,
    ` Discovered ${providerGroups.length} GetQuotes provider groups from terminal infos.`,
    JSON.stringify(providerGroups),
  );
  if (providerGroups.length === 0) {
    throw newError('VEX_QUOTE_PROVIDER_NOT_FOUND', { method: 'GetQuotes' });
  }

  const indices = buildProviderIndices(providerGroups);
  const { productsByGroupId, unavailableAction, unroutableProducts } = routeMisses(
    cacheMissed,
    indices,
    updated_at,
  );

  console.info(
    formatTime(Date.now()),
    `[VEX][Quote]RouteDispatched`,
    ` Routed ${cacheMissed.length} missed quotes to ${productsByGroupId.size} provider groups, ` +
      `${unroutableProducts.size} unroutable products.`,
    JSON.stringify({
      productsByGroupId: [...productsByGroupId.entries()].map(([group_id, productIds]) => ({
        group_id,
        product_ids: [...productIds],
      })),
      unroutable_products: [...unroutableProducts],
      unavailable_action: unavailableAction,
    }),
  );

  if (unroutableProducts.size !== 0) {
    throw newError('VEX_QUOTE_PRODUCT_UNROUTABLE', {
      updated_at,
      unroutable_products: [...unroutableProducts].slice(0, 200),
      unroutable_products_total: unroutableProducts.size,
    });
  }

  quoteState.update(unavailableAction);

  const plannedRequests = planRequests(productsByGroupId, indices.mapGroupIdToGroup);

  console.info(
    formatTime(Date.now()),
    `[VEX][Quote]RequestPlanned`,
    `Planned ${plannedRequests.length} upstream GetQuotes requests.`,
    JSON.stringify(
      plannedRequests.map(({ key, planned }) => ({
        key,
        group_id: planned.group_id,
        product_ids: planned.req.product_ids,
        fields: planned.req.fields,
      })),
    ),
  );

  const actions = await Promise.all(
    plannedRequests.map(async ({ key, planned }) => await requestGetQuotesInFlight(terminal, key, planned)),
  );

  console.debug(
    formatTime(Date.now()),
    `[VEX][Quote]RequestReceived`,
    `Received ${actions.length} upstream GetQuotes responses.`,
    // JSON.stringify(actions),
  );

  for (const action of actions) {
    quoteState.update(action as unknown as IQuoteUpdateAction);
  }
};
