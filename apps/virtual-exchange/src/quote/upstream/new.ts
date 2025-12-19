import { IQuoteUpdateAction } from '@yuants/data-quote';
import { IQuoteField, IQuoteServiceMetadata, parseQuoteServiceMetadataFromSchema } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { filter, from, map, mergeMap, tap, toArray } from 'rxjs';
import { quoteState } from '../state';

interface IQuoteService {
  service_id: string;
  service_group_id: string;
  meta: IQuoteServiceMetadata;
}

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

interface ICellState {
  product_id: string;
  field: IQuoteField;
  service_group_id: string;
  is_dirty: boolean;
  is_fetching: boolean;
  round: number;
}

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

const route = (product_id: string, field: IQuoteField) => {
  return (
    services.find((x) => product_id.startsWith(x.meta.product_id_prefix) && x.meta.fields.includes(field))
      ?.service_group_id || ''
  );
};

export const markDirty = (product_id: string, field: IQuoteField) => {
  const service_group_id = route(product_id, field);
  const item = cells.find((x) => x.product_id === product_id && x.field === field);
  if (!item) {
    cells.push({
      product_id,
      field,
      service_group_id,
      is_dirty: true,
      is_fetching: false,
      round: 0,
    });
  } else {
    item.service_group_id = service_group_id;
    item.is_dirty = true;
  }
  handleServiceGroupId(service_group_id);
};

const handleServiceGroupId = async (serviceGroupId: string): Promise<void> => {
  for (const service of services) {
    if (service.service_group_id === serviceGroupId) {
      if (!isServiceIdRunning.has(service.service_id)) {
        isServiceIdRunning.add(service.service_id);
        handleService(service).finally(() => {
          isServiceIdRunning.delete(service.service_id);
        });
      }
    }
  }
};

const isServiceIdRunning = new Set<string>();

const handleService = async (service: IQuoteService) => {
  while (true) {
    // collect items and make them is_fetching

    // 公平地找出需要被清理的 product_id[] 并对对应的 cell 上锁
    const cellsToFetching: ICellState[] = [];
    const productIdsToFetch = new Set<string>();

    [...cells]
      .sort((a, b) => a.round - b.round)
      .forEach((x) => {
        if (!x.is_dirty) return;
        if (x.is_fetching) return;
        if (x.service_group_id !== service.service_group_id) return;
        if (!service.meta.fields.includes(x.field)) return;

        if (productIdsToFetch.has(x.product_id)) {
          cellsToFetching.push(x);
        } else if (productIdsToFetch.size < (service.meta.max_products_per_request || Infinity)) {
          productIdsToFetch.add(x.product_id);
          cellsToFetching.push(x);
        }
      });

    // totally cleaned, exit
    if (productIdsToFetch.size === 0) return;

    cellsToFetching.forEach((cell) => {
      cell.round++;
      cell.is_fetching = true;
    });

    const res = await makeRequest(service, Array.from(productIdsToFetch)).catch(
      () => ({} as IQuoteUpdateAction),
    );
    cellsToFetching.forEach((cell) => {
      cell.is_fetching = false;
      cell.is_dirty = false;
    });

    quoteState.update(res);

    for (const cell of cells) {
      if (res[cell.product_id]?.[cell.field]) {
        cell.is_dirty = false;
      }
    }
  }
};

const terminal = Terminal.fromNodeEnv();

const makeRequest = async (service: IQuoteService, product_ids: string[]): Promise<IQuoteUpdateAction> => {
  const res = await terminal.client.requestForResponseData<{}, IQuoteUpdateAction>(
    // TODO: 支持强行指定服务 ID
    // service.service_id,
    'GetQuotes',
    { product_ids, fields: service.meta.fields },
  );

  console.info(
    '####',
    `service_id = ${service.service_id}, group = ${
      service.service_group_id
    }, product_ids = ${product_ids.join()}`,
  );

  return res;
};

terminal.terminalInfos$
  .pipe(
    mergeMap((terminalInfos) =>
      from(terminalInfos).pipe(
        //
        mergeMap((terminalInfo) =>
          from(Object.values(terminalInfo.serviceInfo || {})).pipe(
            filter((serviceInfo) => serviceInfo.method === 'GetQuotes'),
            map((serviceInfo): IQuoteService | undefined => {
              try {
                const meta = parseQuoteServiceMetadataFromSchema(serviceInfo.schema);

                const service_group_id =
                  meta.product_id_prefix + meta.fields.join() + (meta.max_products_per_request ?? '');
                return {
                  service_id: serviceInfo.service_id,
                  service_group_id,
                  meta,
                };
              } catch (e) {}
            }),
            filter((x): x is Exclude<typeof x, undefined> => !!x),
          ),
        ),
        toArray(),
        tap((x) => {
          services.length = 0;
          x.forEach((xx) => {
            services.push(xx);
          });
        }),
      ),
    ),
  )
  .subscribe();
