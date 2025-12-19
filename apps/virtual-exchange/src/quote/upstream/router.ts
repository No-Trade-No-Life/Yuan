import { TextEncoder } from 'util';

import { IQuoteServiceRequestByVEX } from '@yuants/exchange';
import { encodePath, fnv1a64Hex, newError } from '@yuants/utils';
import { createSortedPrefixMatcher, IPrefixMatcher } from './prefix-matcher';
import {
  IQuoteKey,
  IQuoteProviderGroup,
  IQuoteProviderInstance,
  IQuoteRequire,
  IQuoteUpdateAction,
} from '../types';

const SEP_BYTE = new Uint8Array([0xff]);

const encodeStrings = (parts: string[]): Uint8Array => {
  const buffers: Uint8Array[] = [];
  for (const part of parts) {
    buffers.push(new TextEncoder().encode(part));
    buffers.push(SEP_BYTE);
  }
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
};

const fnv1a64HexFromStrings = (parts: string[]): string => fnv1a64Hex(encodeStrings(parts));

export type IPlannedRequest = {
  group_id: string;
  instances: IQuoteProviderInstance[];
  req: IQuoteServiceRequestByVEX;
};

export type IPlannedRequestWithKey = { key: string; planned: IPlannedRequest };

export type QuoteUpstreamPlan = {
  requests: IPlannedRequestWithKey[];
};

export type IProviderIndices = {
  mapGroupIdToGroup: Map<string, IQuoteProviderGroup>;
  prefixMatcher: IPrefixMatcher<string>;
  mapFieldToGroupIds: Map<IQuoteKey, Set<string>>;
};

export const buildProviderIndices = (groups: IQuoteProviderGroup[]): IProviderIndices => {
  const mapGroupIdToGroup = new Map(groups.map((x) => [x.group_id, x] as const));
  const prefixMatcher = createSortedPrefixMatcher(
    groups.map((group) => ({ prefix: group.meta.product_id_prefix, value: group.group_id })),
  );
  const mapFieldToGroupIds = new Map<IQuoteKey, Set<string>>();
  for (const group of groups) {
    for (const field of group.meta.fields as IQuoteKey[]) {
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

const createRequestKey = (group_id: string, batchProductIds: string[]) =>
  encodePath(group_id, fnv1a64HexFromStrings(batchProductIds));

const planRequests = (params: {
  productsByGroupId: Map<string, Set<string>>;
  mapGroupIdToGroup: Map<string, IQuoteProviderGroup>;
}): IPlannedRequestWithKey[] => {
  const { productsByGroupId, mapGroupIdToGroup } = params;
  const plannedRequests: IPlannedRequestWithKey[] = [];
  for (const [group_id, productIdSet] of productsByGroupId) {
    const group = mapGroupIdToGroup.get(group_id);
    if (!group) continue;
    const sortedProductIds = [...productIdSet].sort();
    const max = group.meta.max_products_per_request ?? sortedProductIds.length;
    for (let i = 0; i < sortedProductIds.length; i += max) {
      const batchProductIds = sortedProductIds.slice(i, i + max);
      const key = createRequestKey(group_id, batchProductIds);
      plannedRequests.push({
        key,
        planned: {
          group_id,
          instances: Array.from(group.mapTerminalIdToInstance.values()),
          req: { product_ids: batchProductIds, fields: group.meta.fields as any },
        },
      });
    }
  }
  return plannedRequests;
};

export interface IQuoteRouter {
  planOrThrow: (misses: IQuoteRequire[], indices: IProviderIndices, updated_at: number) => QuoteUpstreamPlan;
}

export const createQuoteRouter = (): IQuoteRouter => ({
  planOrThrow: (misses, indices, updated_at) => {
    const { prefixMatcher, mapFieldToGroupIds, mapGroupIdToGroup } = indices;
    const productsByGroupId = new Map<string, Set<string>>();

    const mapProductIdToGroupIds = new Map<string, string[]>();

    for (const miss of misses) {
      const { product_id, field } = miss;

      let productGroupIds = mapProductIdToGroupIds.get(product_id);
      if (!productGroupIds) {
        productGroupIds = prefixMatcher.match(product_id);
        mapProductIdToGroupIds.set(product_id, productGroupIds);
      }

      const fieldGroupIds = mapFieldToGroupIds.get(field);
      if (!fieldGroupIds) {
        continue;
      }

      for (const group_id of productGroupIds) {
        if (!fieldGroupIds.has(group_id)) continue;
        let productIds = productsByGroupId.get(group_id);
        if (!productIds) {
          productIds = new Set<string>();
          productsByGroupId.set(group_id, productIds);
        }
        productIds.add(product_id);
      }
    }

    return {
      requests: planRequests({ productsByGroupId, mapGroupIdToGroup }),
    };
  },
});
