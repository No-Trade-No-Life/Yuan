import { encodePath } from '@yuants/utils';
import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    path: IPath;
  }
}

interface IPath {
  type: string;
  key: string;
  name: string;
  parent: string;
}

addDataRecordWrapper('path', (x) => ({
  id: encodePath(x.type, x.key, x.parent, x.name),
  type: 'path',
  updated_at: Date.now(),
  tags: {
    type: x.type,
    path: x.key,
    name: x.name,
    parent: x.parent,
  },
  origin: x,
}));

addDataRecordSchema('path', {
  type: 'object',
  required: ['type', 'key', 'name', 'parent'],
  properties: {
    type: { type: 'string' },
    key: { type: 'string' },
    name: { type: 'string' },
    parent: { type: 'string' },
  },
});
