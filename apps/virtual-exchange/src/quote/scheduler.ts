import { IQuoteUpdateAction } from '@yuants/data-quote';
import { IQuoteField, IQuoteServiceMetadata, parseQuoteServiceMetadataFromSchema } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { filter, from, map, mergeMap, tap, toArray } from 'rxjs';
import { quoteState } from './state';

interface IQuoteService {
  service_id: string;
  service_group_id: string;
  meta: IQuoteServiceMetadata;
  metaFieldsSet: Set<IQuoteField>;
}

interface ICellState {
  product_id: string;
  field: IQuoteField;
  service_group_id: string;
  is_dirty: boolean;
  is_fetching: boolean;
  round: number;
}

type IFifoQueue<T> = {
  items: T[];
  head: number;
};

const createFifoQueue = <T>(): IFifoQueue<T> => ({ items: [], head: 0 });

const fifoEnqueue = <T>(queue: IFifoQueue<T>, value: T) => {
  queue.items.push(value);
};

const fifoDequeue = <T>(queue: IFifoQueue<T>): T | undefined => {
  if (queue.head >= queue.items.length) return undefined;
  const value = queue.items[queue.head++];
  if (queue.head > 1024 && queue.head * 2 > queue.items.length) {
    queue.items = queue.items.slice(queue.head);
    queue.head = 0;
  }
  return value;
};

const fifoSize = <T>(queue: IFifoQueue<T>): number => queue.items.length - queue.head;

const isTraceEnabled = process.env.VEX_QUOTE_UPSTREAM_REFINE_TRACE === '1';

// Query -> Make Cell Dirty -> Trigger Dirty Check

// Dirty Check():
// Acquire dirtyCheck lock
// Foreach Dirty cell in parallel:
//.   Routing the dirty cell to ServiceID
//.   Acquire Service Lock
//.      if success:
//           request the service and wait for response
//.          release service lock
//           clean cells
//.      if failed: do nothing.
// Release dirtyCheck lock
// if any cell dirty remaining, call dirtyCheck()

// (service_id, service_group_id) -> sync func state (hash func)
const services: Array<IQuoteService> = [];
const mapGroupIdToServices = new Map<string, IQuoteService[]>();

// (product_id, field, service_group_id, is_dirty = true, is_fetching)
// use-case 1: find unique product_ids (not is_fetching) by service_group_id
// use-case 2: mark
/**
 * Use cases:
 * - upsert items (when queryQuotes)
 * - find unique product_ids (is_dirty = true and is_fetching = false) by service_group_id
 * - when service fired, update is_fetching = true for some items (product_id, field)
 * - when service failed, update is_fetching = false for some items (product_id, field)
 * - when service success, update is_fetching = false and is_dirty = false for some items (product_id, field)
 */
export const cells: Array<ICellState> = [];
const mapCellKeyToCell = new Map<string, ICellState>();

type IGroupState = {
  productQueue: IFifoQueue<string>;
  inQueue: Set<string>;
  fetchingProducts: Set<string>;
  dirtyFieldsByProduct: Map<string, Set<IQuoteField>>;
};

const mapGroupIdToState = new Map<string, IGroupState>();

const getOrCreateGroupState = (group_id: string): IGroupState => {
  const existing = mapGroupIdToState.get(group_id);
  if (existing) return existing;
  const next: IGroupState = {
    productQueue: createFifoQueue(),
    inQueue: new Set<string>(),
    fetchingProducts: new Set<string>(),
    dirtyFieldsByProduct: new Map<string, Set<IQuoteField>>(),
  };
  mapGroupIdToState.set(group_id, next);
  return next;
};

const route = (product_id: string, field: IQuoteField) => {
  for (const service of services) {
    if (!product_id.startsWith(service.meta.product_id_prefix)) continue;
    if (!service.metaFieldsSet.has(field)) continue;
    return service.service_group_id;
  }
  return '';
};

const enqueueDirty = (params: { product_id: string; field: IQuoteField; service_group_id: string }) => {
  const { product_id, field, service_group_id } = params;
  if (!service_group_id) return;
  const groupState = getOrCreateGroupState(service_group_id);
  const dirtyFields =
    groupState.dirtyFieldsByProduct.get(product_id) ??
    (() => {
      const next = new Set<IQuoteField>();
      groupState.dirtyFieldsByProduct.set(product_id, next);
      return next;
    })();
  dirtyFields.add(field);

  if (groupState.fetchingProducts.has(product_id)) return;
  if (groupState.inQueue.has(product_id)) return;
  groupState.inQueue.add(product_id);
  fifoEnqueue(groupState.productQueue, product_id);
};

export const markDirty = (product_id: string, field: IQuoteField) => {
  const service_group_id = route(product_id, field);

  const cellKey = encodePath(product_id, field);
  const existing = mapCellKeyToCell.get(cellKey);
  if (!existing) {
    const cell: ICellState = {
      product_id,
      field,
      service_group_id,
      is_dirty: true,
      is_fetching: false,
      round: 0,
    };
    mapCellKeyToCell.set(cellKey, cell);
    cells.push(cell);
  } else {
    existing.service_group_id = service_group_id;
    existing.is_dirty = true;
  }

  enqueueDirty({ product_id, field, service_group_id });
  scheduleServiceGroupId(service_group_id);
};

const isServiceIdRunning = new Set<string>();

const scheduleServiceGroupId = (serviceGroupId: string): void => {
  if (!serviceGroupId) return;
  const serviceList = mapGroupIdToServices.get(serviceGroupId);
  if (!serviceList || serviceList.length === 0) return;

  for (const service of serviceList) {
    if (isServiceIdRunning.has(service.service_id)) continue;
    isServiceIdRunning.add(service.service_id);
    handleService(service).finally(() => {
      isServiceIdRunning.delete(service.service_id);
    });
  }
};

const handleService = async (service: IQuoteService) => {
  const groupState = mapGroupIdToState.get(service.service_group_id);
  if (!groupState) return;

  while (true) {
    const maxProducts = service.meta.max_products_per_request ?? Infinity;
    const fetchedFieldsByProduct = new Map<string, Set<IQuoteField>>();
    const productsToFetch: string[] = [];
    const cellsToFetch: ICellState[] = [];

    while (productsToFetch.length < maxProducts && fifoSize(groupState.productQueue) > 0) {
      const product_id = fifoDequeue(groupState.productQueue);
      if (!product_id) break;
      groupState.inQueue.delete(product_id);

      if (groupState.fetchingProducts.has(product_id)) continue;
      const dirtyFields = groupState.dirtyFieldsByProduct.get(product_id);
      if (!dirtyFields || dirtyFields.size === 0) continue;

      const matchedFields: IQuoteField[] = [];
      for (const f of dirtyFields) {
        if (!service.metaFieldsSet.has(f)) continue;
        const cell = mapCellKeyToCell.get(encodePath(product_id, f));
        if (!cell) continue;
        if (cell.service_group_id !== service.service_group_id) continue;
        if (!cell.is_dirty) continue;
        if (cell.is_fetching) continue;
        matchedFields.push(f);
        cellsToFetch.push(cell);
      }

      if (matchedFields.length === 0) continue;
      productsToFetch.push(product_id);
      groupState.fetchingProducts.add(product_id);
      fetchedFieldsByProduct.set(product_id, new Set(matchedFields));
    }

    if (productsToFetch.length === 0) return;

    for (const cell of cellsToFetch) {
      cell.round++;
      cell.is_fetching = true;
    }

    const res = await makeRequest(service, productsToFetch).catch(() => ({} as IQuoteUpdateAction));
    quoteState.update(res);

    for (const cell of cellsToFetch) {
      cell.is_fetching = false;
      cell.is_dirty = false;
    }

    for (const product_id of productsToFetch) {
      groupState.fetchingProducts.delete(product_id);
      const dirtyFields = groupState.dirtyFieldsByProduct.get(product_id);
      const fetchedFields = fetchedFieldsByProduct.get(product_id);
      if (!dirtyFields || !fetchedFields) continue;
      for (const f of fetchedFields) {
        dirtyFields.delete(f);
      }
      if (dirtyFields.size === 0) {
        groupState.dirtyFieldsByProduct.delete(product_id);
        continue;
      }
      if (!groupState.inQueue.has(product_id)) {
        groupState.inQueue.add(product_id);
        fifoEnqueue(groupState.productQueue, product_id);
      }
    }
  }
};

const terminal = Terminal.fromNodeEnv();

const makeRequest = async (service: IQuoteService, product_ids: string[]): Promise<IQuoteUpdateAction> => {
  const res = await terminal.client.requestForResponseData<{}, IQuoteUpdateAction>('GetQuotes', {
    product_ids,
    fields: service.meta.fields,
  });
  if (isTraceEnabled) {
    console.info(
      formatTime(Date.now()),
      `[VEX][Quote][Refine]GetQuotes`,
      `service_id=${service.service_id}`,
      `group=${service.service_group_id}`,
      `products=${product_ids.length}`,
    );
  }
  return res;
};

terminal.terminalInfos$
  .pipe(
    mergeMap((terminalInfos) =>
      from(terminalInfos).pipe(
        mergeMap((terminalInfo) =>
          from(Object.values(terminalInfo.serviceInfo || {})).pipe(
            filter((serviceInfo) => serviceInfo.method === 'GetQuotes'),
            map((serviceInfo): IQuoteService | undefined => {
              try {
                const meta = parseQuoteServiceMetadataFromSchema(serviceInfo.schema);
                const service_group_id = encodePath(
                  meta.product_id_prefix,
                  (meta.fields as any[]).join(','),
                  meta.max_products_per_request ?? '',
                );
                return {
                  service_id: serviceInfo.service_id,
                  service_group_id,
                  meta,
                  metaFieldsSet: new Set(meta.fields),
                };
              } catch {}
            }),
            filter((x): x is Exclude<typeof x, undefined> => !!x),
          ),
        ),
        toArray(),
        tap((x) => {
          services.length = 0;
          mapGroupIdToServices.clear();
          x.forEach((service) => {
            services.push(service);
            const list = mapGroupIdToServices.get(service.service_group_id) ?? [];
            list.push(service);
            mapGroupIdToServices.set(service.service_group_id, list);
          });
        }),
      ),
    ),
  )
  .subscribe();
