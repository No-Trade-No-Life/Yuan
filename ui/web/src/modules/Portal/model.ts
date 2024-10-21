import { addDataRecordSchema, addDataRecordWrapper, UUID } from '@yuants/data-model';

declare module '@yuants/data-model/lib/DataRecord' {
  interface IDataRecordTypes {
    portal_relation: IPortalRelation;
  }
}

interface IPortalRelation {
  external_host_url: string;
  type: 'request' | 'channel';
  direction: 'export' | 'import';
  method?: string;
  schema: any;
}

addDataRecordSchema('portal_relation', {
  properties: {
    external_host_url: { type: 'string' },
    type: { type: 'string', enum: ['request', 'channel'] },
    direction: { type: 'string', enum: ['export', 'import'] },
    method: { type: 'string' },
    schema: { type: 'object' },
  },
});

addDataRecordWrapper('portal_relation', (x) => ({
  type: 'portal_relation',
  id: UUID(),
  updated_at: Date.now(),
  tags: {
    external_host_url: x.external_host_url,
    type: x.type,
    direction: x.direction,
  },
  origin: x,
}));
