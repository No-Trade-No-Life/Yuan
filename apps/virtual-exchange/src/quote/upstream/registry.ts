import { IQuoteServiceMetadata, parseQuoteServiceMetadataFromSchema } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime, listWatch, newError } from '@yuants/utils';
import { EMPTY, map, of, tap } from 'rxjs';
import {
  IQuoteKey,
  IQuoteProviderGroup,
  IQuoteProviderInstance,
  IQuoteRequire,
  IQuoteState,
  IQuoteUpdateAction,
} from '../types';
import { createGetQuotesExecutor } from './executor';
import {
  buildProviderIndices,
  createQuoteRouter,
  IProviderIndices,
  IPlannedRequestWithKey,
  QuoteUpstreamPlan,
} from './router';

export interface IQuoteProviderRegistry {
  snapshot: () => { groups: IQuoteProviderGroup[]; indices: IProviderIndices };
  planOrThrow: (misses: IQuoteRequire[], updated_at: number) => QuoteUpstreamPlan;
  execute: (requests: IPlannedRequestWithKey[]) => Promise<IQuoteUpdateAction[]>;
  fillQuoteStateFromUpstream: (params: {
    quoteState: IQuoteState;
    cacheMissed: IQuoteRequire[];
    updated_at: number;
  }) => Promise<void>;
}

const normalizeMetadataForGroup = (metadata: IQuoteServiceMetadata): IQuoteServiceMetadata => {
  const fields = [...(metadata.fields as unknown as IQuoteKey[])].sort();
  return { ...metadata, fields };
};

export const createQuoteProviderRegistry = (terminal: Terminal): IQuoteProviderRegistry => {
  const router = createQuoteRouter();
  const executor = createGetQuotesExecutor(terminal);

  const mapGroupIdToGroup = new Map<string, IQuoteProviderGroup>();
  let version = 0;
  let cachedIndices: { version: number; indices: IProviderIndices } | undefined;

  const quoteServiceInfos$ = terminal.terminalInfos$.pipe(
    map((infos) =>
      infos.flatMap((info) =>
        Object.values(info.serviceInfo ?? {})
          .filter((serviceInfo) => serviceInfo.method === 'GetQuotes')
          .map((serviceInfo) => ({ terminal_id: info.terminal_id, serviceInfo })),
      ),
    ),
  );

  quoteServiceInfos$
    .pipe(
      listWatch(
        (v) => v.serviceInfo.service_id,
        (v) => {
          console.info(
            formatTime(Date.now()),
            `[VEX][Quote]DiscoveringGetQuotesProvider...`,
            `from terminal ${v.terminal_id}`,
            `service ${v.serviceInfo.service_id}`,
            `schema:  ${JSON.stringify(v.serviceInfo.schema)}`,
          );
          try {
            const metadata = normalizeMetadataForGroup(
              parseQuoteServiceMetadataFromSchema(v.serviceInfo.schema),
            );
            const group_id = encodePath(
              metadata.product_id_prefix,
              (metadata.fields as any[]).join(','),
              metadata.max_products_per_request ?? '',
            );
            const provider: IQuoteProviderInstance = {
              terminal_id: v.terminal_id,
              service_id: v.serviceInfo.service_id || v.serviceInfo.method,
            };
            const group =
              mapGroupIdToGroup.get(group_id) ??
              (() => {
                const next: IQuoteProviderGroup = {
                  group_id,
                  meta: metadata,
                  mapTerminalIdToInstance: new Map<string, IQuoteProviderInstance>(),
                };
                mapGroupIdToGroup.set(group_id, next);
                return next;
              })();
            group.mapTerminalIdToInstance.set(provider.terminal_id, provider);
            version++;
            return of(void 0).pipe(
              tap({
                unsubscribe: () => {
                  mapGroupIdToGroup.get(group_id)?.mapTerminalIdToInstance.delete(v.terminal_id);
                  if (mapGroupIdToGroup.get(group_id)?.mapTerminalIdToInstance.size === 0) {
                    mapGroupIdToGroup.delete(group_id);
                  }
                  version++;
                },
              }),
            );
          } catch {
            console.info(
              formatTime(Date.now()),
              `[VEX][Quote]IgnoredGetQuotesProvider`,
              `Ignored GetQuotes provider from terminal ${v.terminal_id}`,
              `service ${v.serviceInfo.service_id} due to invalid schema.`,
            );
            return EMPTY;
          }
        },
      ),
    )
    .subscribe();

  const snapshot = () => {
    const groups = Array.from(mapGroupIdToGroup.values());
    if (!cachedIndices || cachedIndices.version !== version) {
      cachedIndices = { version, indices: buildProviderIndices(groups) };
    }
    return { groups, indices: cachedIndices.indices };
  };

  const planOrThrow = (misses: IQuoteRequire[], updated_at: number): QuoteUpstreamPlan => {
    const { groups, indices } = snapshot();
    if (groups.length === 0) throw newError('VEX_QUOTE_PROVIDER_NOT_FOUND', { method: 'GetQuotes' });
    return router.planOrThrow(misses, indices, updated_at);
  };

  const execute = async (requests: IPlannedRequestWithKey[]): Promise<IQuoteUpdateAction[]> =>
    (await executor.execute(requests)) as any;

  const fillQuoteStateFromUpstream: IQuoteProviderRegistry['fillQuoteStateFromUpstream'] = async (params) => {
    const { quoteState, cacheMissed, updated_at } = params;
    if (cacheMissed.length === 0) return;

    const { groups } = snapshot();
    console.info(
      formatTime(Date.now()),
      `[VEX][Quote]UpstreamProviderDiscovery`,
      ` Discovered ${groups.length} GetQuotes provider groups from terminal infos.`,
      JSON.stringify(groups),
    );

    const plan = planOrThrow(cacheMissed, updated_at);

    const mapGroupIdToProductIds = new Map<string, Set<string>>();
    for (const { planned } of plan.requests) {
      let productIds = mapGroupIdToProductIds.get(planned.group_id);
      if (!productIds) {
        productIds = new Set<string>();
        mapGroupIdToProductIds.set(planned.group_id, productIds);
      }
      for (const product_id of planned.req.product_ids) productIds.add(product_id);
    }
    console.info(
      formatTime(Date.now()),
      `[VEX][Quote]RouteDispatched`,
      ` Routed ${cacheMissed.length} missed quotes to ${mapGroupIdToProductIds.size} provider groups.`,
      JSON.stringify({
        productsByGroupId: [...mapGroupIdToProductIds.entries()].map(([group_id, productIds]) => ({
          group_id,
          product_ids: [...productIds],
        })),
      }),
    );

    console.info(
      formatTime(Date.now()),
      `[VEX][Quote]RequestPlanned`,
      `Planned ${plan.requests.length} upstream GetQuotes requests.`,
      JSON.stringify(
        plan.requests.map(({ key, planned }) => ({
          key,
          group_id: planned.group_id,
          product_ids: planned.req.product_ids,
          fields: planned.req.fields,
        })),
      ),
    );

    const actions = await execute(plan.requests);
    console.debug(
      formatTime(Date.now()),
      `[VEX][Quote]RequestReceived`,
      `Received ${actions.length} upstream GetQuotes responses.`,
      JSON.stringify(actions),
    );

    for (const action of actions) {
      quoteState.update(action);
    }
  };

  return { snapshot, planOrThrow, execute, fillQuoteStateFromUpstream };
};
