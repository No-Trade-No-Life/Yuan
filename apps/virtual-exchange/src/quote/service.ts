import { Terminal } from '@yuants/protocol';
import { IQuoteField } from '@yuants/exchange';
import { quoteState } from './state';
import { IQuoteKey, IQuoteRequire, IQuoteState, IQuoteUpdateAction } from './types';
import { markDirty } from './scheduler';

const terminal = Terminal.fromNodeEnv();

const normalizeStrings = (values: string[]) => [...new Set(values)].sort();
const normalizeFields = (values: IQuoteKey[]) => [...new Set(values)].sort();

const analyzeRequestedQuotes = (
  quoteState: IQuoteState,
  product_ids: string[],
  fields: IQuoteKey[],
  updated_at: number,
): { needUpdate: IQuoteRequire[] } => {
  const needUpdate: IQuoteRequire[] = [];
  for (const product_id of product_ids) {
    for (const field of fields) {
      const tuple = quoteState.getValueTuple(product_id, field);
      if (tuple === undefined) {
        needUpdate.push({ product_id, field });
        continue;
      }
      if (tuple[1] < updated_at) {
        needUpdate.push({ product_id, field });
      }
    }
  }
  return { needUpdate };
};

terminal.server.provideService<IQuoteUpdateAction>('VEX/UpdateQuotes', {}, async (msg) => {
  quoteState.update(msg.req);
  return { res: { code: 0, message: 'OK' } };
});

terminal.server.provideService<{}, IQuoteUpdateAction>('VEX/DumpQuoteState', {}, async () => {
  return { res: { code: 0, message: 'OK', data: quoteState.dumpAsObject() } };
});

terminal.server.provideService<
  { product_ids: string[]; fields: IQuoteKey[]; updated_at: number },
  Record<string, Partial<Record<IQuoteKey, string>>>
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

    const { needUpdate } = analyzeRequestedQuotes(quoteState, product_ids, fields, updated_at);
    for (const { product_id, field } of needUpdate) {
      markDirty(product_id, field as any as IQuoteField);
    }

    const data = quoteState.filterValues(product_ids, fields);
    return { res: { code: 0, message: 'OK', data } };
  },
);
