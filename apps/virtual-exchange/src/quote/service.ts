import { Terminal } from '@yuants/protocol';
import { createQuoteState } from './state';
import { IQuoteKey, IQuoteUpdateAction } from './types';

const terminal = Terminal.fromNodeEnv();

const quoteState = createQuoteState();

terminal.server.provideService<IQuoteUpdateAction>('VEX/UpdateQuotes', {}, async (msg) => {
  quoteState.update(msg.req);
  return { res: { code: 0, message: 'OK' } };
});

terminal.server.provideService<{}, IQuoteUpdateAction>('VEX/DumpQuoteState', {}, async (msg) => {
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
    const { product_ids, fields, updated_at } = msg.req;
    // 分析缓存缺失的字段
    const cacheMissed: Array<{ product_id: string; field: IQuoteKey }> = [];
    for (const product_id of product_ids) {
      for (const field of fields) {
        const tuple = quoteState.getValueTuple(product_id, field);
        if (tuple === undefined || tuple[1] < updated_at) {
          cacheMissed.push({ product_id, field });
        }
      }
    }
    // TODO: 集中规划需要发送的查询请求，并更新到状态中
    // 注意需要限制在途请求数量和复用在途请求的结果，以免过载和浪费资源
    // await Promise.all;

    // 从状态中获取数据返回
    const data = quoteState.filter(product_ids, fields, updated_at);

    return { res: { code: 0, message: 'OK', data } };
  },
);
