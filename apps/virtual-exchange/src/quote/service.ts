import { Terminal } from '@yuants/protocol';
import { newError } from '@yuants/utils';
import { createQuoteState } from './state';
import { IQuoteKey, IQuoteRequire, IQuoteState, IQuoteUpdateAction } from './types';
import { createQuoteProviderRegistry } from './upstream';

const terminal = Terminal.fromNodeEnv();

const quoteState = createQuoteState();
const quoteProviderRegistry = createQuoteProviderRegistry(terminal);

const assertFreshnessSatisfied = (
  data: IQuoteUpdateAction,
  params: { product_ids: string[]; fields: IQuoteKey[]; updated_at: number },
) => {
  console.info(
    '[VEX][Quote] Asserting freshness satisfied for requested quotes.',
    JSON.stringify(params),
    JSON.stringify(data),
  );
  const { product_ids, fields, updated_at } = params;
  const stillMissed: Array<{ product_id: string; field: IQuoteKey }> = [];
  for (const product_id of product_ids) {
    for (const field of fields) {
      if (!data[product_id]?.[field]) {
        stillMissed.push({ product_id, field });
      }
    }
  }
  if (stillMissed.length > 0) {
    throw newError('VEX_QUOTE_FRESHNESS_NOT_SATISFIED', {
      updated_at,
      missed: stillMissed.slice(0, 200),
      missed_total: stillMissed.length,
    });
  }
};

terminal.server.provideService<IQuoteUpdateAction>('VEX/UpdateQuotes', {}, async (msg) => {
  quoteState.update(msg.req);
  return { res: { code: 0, message: 'OK' } };
});

terminal.server.provideService<{}, IQuoteUpdateAction>('VEX/DumpQuoteState', {}, async () => {
  return { res: { code: 0, message: 'OK', data: quoteState.dumpAsObject() } };
});

const computeCacheMissed = (
  quoteState: IQuoteState,
  product_ids: string[],
  fields: IQuoteKey[],
  updated_at: number,
): IQuoteRequire[] => {
  const cacheMissed: IQuoteRequire[] = [];
  for (const product_id of product_ids) {
    for (const field of fields) {
      const tuple = quoteState.getValueTuple(product_id, field);
      if (tuple === undefined || tuple[1] < updated_at) {
        cacheMissed.push({ product_id, field });
      }
    }
  }
  return cacheMissed;
};

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
    const { product_ids, fields, updated_at } = msg.req;

    const cacheMissed = computeCacheMissed(quoteState, product_ids, fields, updated_at);
    await quoteProviderRegistry.fillQuoteStateFromUpstream({ quoteState, cacheMissed, updated_at });

    const data = quoteState.filter(product_ids, fields, updated_at);
    assertFreshnessSatisfied(data, { product_ids, fields, updated_at });
    return { res: { code: 0, message: 'OK', data } };
  },
);
