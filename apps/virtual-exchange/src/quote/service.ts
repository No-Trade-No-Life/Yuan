import { Terminal } from '@yuants/protocol';
import { formatTime, newError } from '@yuants/utils';
import { Subject, concatMap, defer } from 'rxjs';
import { createQuoteState } from './state';
import { IQuoteKey, IQuoteRequire, IQuoteState, IQuoteUpdateAction } from './types';
import { createQuoteProviderRegistry } from './upstream';

const terminal = Terminal.fromNodeEnv();

const quoteState = createQuoteState();
const quoteProviderRegistry = createQuoteProviderRegistry(terminal);

type UpdateTask = { product_ids: string[]; fields: IQuoteKey[]; updated_at: number };

type IQuoteUpdateQueueStatus = {
  pending: number;
  in_flight: number;
  queued_total: number;
  started_total: number;
  processed_total: number;
  last_enqueued_at?: number;
  last_started_at?: number;
  last_processed_at?: number;
  last_error?: { at: number; code?: string; message?: string };
};

const normalizeStrings = (values: string[]) => [...new Set(values)].sort();
const normalizeFields = (values: IQuoteKey[]) => [...new Set(values)].sort();

const analyzeRequestedQuotes = (
  quoteState: IQuoteState,
  product_ids: string[],
  fields: IQuoteKey[],
  updated_at: number,
): { missing: IQuoteRequire[]; needUpdate: IQuoteRequire[] } => {
  const missing: IQuoteRequire[] = [];
  const needUpdate: IQuoteRequire[] = [];
  for (const product_id of product_ids) {
    for (const field of fields) {
      const tuple = quoteState.getValueTuple(product_id, field);
      if (tuple === undefined) {
        missing.push({ product_id, field });
        needUpdate.push({ product_id, field });
        continue;
      }
      if (tuple[1] < updated_at) {
        needUpdate.push({ product_id, field });
      }
    }
  }
  return { missing, needUpdate };
};

const filterLatest = (
  quoteState: IQuoteState,
  product_ids: string[],
  fields: IQuoteKey[],
): IQuoteUpdateAction => {
  const result: IQuoteUpdateAction = {};
  for (const product_id of product_ids) {
    result[product_id] = {};
    for (const field of fields) {
      const tuple = quoteState.getValueTuple(product_id, field);
      if (tuple) {
        result[product_id][field] = tuple;
      }
    }
  }
  return result;
};

const assertNotMissing = (missing: IQuoteRequire[], updated_at: number) => {
  if (missing.length > 0) {
    throw newError('VEX_QUOTE_FRESHNESS_NOT_SATISFIED', {
      updated_at,
      missed: missing.slice(0, 200),
      missed_total: missing.length,
    });
  }
};

const updateQueue$ = new Subject<UpdateTask>();
const updateQueueStats: Omit<IQuoteUpdateQueueStatus, 'pending' | 'in_flight'> = {
  queued_total: 0,
  started_total: 0,
  processed_total: 0,
};

const getQueueStatus = (): IQuoteUpdateQueueStatus => {
  const pending = updateQueueStats.queued_total - updateQueueStats.started_total;
  const in_flight = updateQueueStats.started_total - updateQueueStats.processed_total;
  return {
    pending,
    in_flight,
    ...updateQueueStats,
  };
};

const enqueueUpdateTask = (task: UpdateTask) => {
  updateQueueStats.queued_total++;
  updateQueueStats.last_enqueued_at = Date.now();
  updateQueue$.next(task);
};

const summarizeError = (error: unknown): { code?: string; message?: string } => {
  if (typeof error === 'object' && error !== null) {
    const code = 'code' in error ? (error as any).code : undefined;
    const message = 'message' in error ? (error as any).message : undefined;
    return {
      code: typeof code === 'string' ? code : undefined,
      message: typeof message === 'string' ? message : undefined,
    };
  }
  return {};
};

const processUpdateTask = async (task: UpdateTask) => {
  const { needUpdate } = analyzeRequestedQuotes(quoteState, task.product_ids, task.fields, task.updated_at);
  await quoteProviderRegistry.fillQuoteStateFromUpstream({
    quoteState,
    cacheMissed: needUpdate,
    updated_at: task.updated_at,
  });
};

updateQueue$
  .pipe(
    concatMap((task) =>
      defer(async () => {
        updateQueueStats.started_total++;
        updateQueueStats.last_started_at = Date.now();

        try {
          await processUpdateTask(task);
        } catch (error) {
          const summary = summarizeError(error);
          updateQueueStats.last_error = { at: Date.now(), ...summary };
          console.info(
            formatTime(Date.now()),
            `[VEX][Quote]UpdateQueueTaskFailed`,
            `product_ids=${task.product_ids.length} fields=${task.fields.length} updated_at=${task.updated_at}`,
            JSON.stringify(summary),
          );
        } finally {
          updateQueueStats.processed_total++;
          updateQueueStats.last_processed_at = Date.now();
        }
      }),
    ),
  )
  .subscribe();

terminal.server.provideService<IQuoteUpdateAction>('VEX/UpdateQuotes', {}, async (msg) => {
  quoteState.update(msg.req);
  return { res: { code: 0, message: 'OK' } };
});

terminal.server.provideService<{}, IQuoteUpdateAction>('VEX/DumpQuoteState', {}, async () => {
  return { res: { code: 0, message: 'OK', data: quoteState.dumpAsObject() } };
});

terminal.server.provideService<
  { product_ids: string[]; fields: IQuoteKey[]; updated_at: number },
  IQuoteUpdateAction
>(
  'VEX/QueryQuotes',
  {
    type: 'object',
    required: ['product_ids', 'fields', 'updated_at'],
    properties: {
      product_ids: {
        type: 'array',
        items: { type: 'string' },
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
      },
      updated_at: { type: 'number' },
    },
  },
  async (msg) => {
    const product_ids = normalizeStrings(msg.req.product_ids);
    const fields = normalizeFields(msg.req.fields);
    const { updated_at } = msg.req;

    const { missing, needUpdate } = analyzeRequestedQuotes(quoteState, product_ids, fields, updated_at);
    if (needUpdate.length > 0) {
      enqueueUpdateTask({ product_ids, fields, updated_at });
    }

    const data = filterLatest(quoteState, product_ids, fields);
    assertNotMissing(missing, updated_at);
    return { res: { code: 0, message: 'OK', data } };
  },
);

terminal.server.provideService<{}, IQuoteUpdateQueueStatus>('VEX/QuoteUpdateQueueStatus', {}, async () => {
  return { res: { code: 0, message: 'OK', data: getQueueStatus() } };
});
