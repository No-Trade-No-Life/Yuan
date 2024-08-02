import { addDataRecordSchema, addDataRecordWrapper, encodePath } from '@yuants/data-model';
import { ImapMessageAttributes } from 'imap';
import { ParsedMail } from 'mailparser';

declare module '@yuants/data-model/lib/DataRecord' {
  export interface IDataRecordTypes {
    email: {
      address: string;
      attrs: ImapMessageAttributes;
      body: ParsedMail;
    };
  }
}

addDataRecordSchema('email', {
  type: 'object',
  properties: {
    address: { type: 'string' },
    attrs: {
      type: 'object',
      required: ['uid'],
      properties: {
        uid: {
          type: 'number',
        },
      },
    },
  },
});

addDataRecordWrapper('email', (x) => ({
  type: 'email',
  id: encodePath(x.address, x.attrs.uid),
  created_at: x.attrs.date.getTime(),
  frozen_at: x.attrs.date.getTime(),
  updated_at: Date.now(),
  tags: {
    address: x.address,
    uid: `${x.attrs.uid}`,
  },
  origin: x,
}));
