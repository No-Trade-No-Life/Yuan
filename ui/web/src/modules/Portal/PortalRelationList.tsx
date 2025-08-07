import { createColumnHelper } from '@tanstack/react-table';
import { formatTime, getDataRecordWrapper, IDataRecord, IDataRecordTypes } from '@yuants/data-model';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { Button } from '../Interactive';
import { firstValueFrom, from, lastValueFrom } from 'rxjs';
import { terminal$ } from '../Terminals';
import { writeDataRecords } from '@yuants/protocol';

type Item = IDataRecordTypes['portal_relation'];

function newRecord(): Partial<Item> {
  return {};
}

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<IDataRecord<Item>>();
    return [
      columnHelper.accessor('updated_at', {
        header: () => '更新时间',
        cell: (ctx) => formatTime(ctx.getValue()),
      }),
      columnHelper.accessor('origin.type', {
        header: () => '类型',
      }),
      columnHelper.accessor('origin.method', {
        header: () => '方法',
      }),
      columnHelper.accessor('origin.external_host_url', {
        header: () => '外部主机地址',
      }),
      columnHelper.accessor('origin.direction', {
        header: () => '方向',
      }),
      columnHelper.accessor('origin.schema', {
        header: () => '模式',
        cell: (ctx) => JSON.stringify(ctx.getValue()),
      }),
      columnHelper.accessor('tags', {
        header: () => '模式',
        cell: (ctx) => JSON.stringify(ctx.getValue()),
      }),
    ];
  };
}

registerPage('PortalRelationList', () => {
  return (
    <DataRecordView
      TYPE="portal_relation"
      columns={defineColumns()}
      newRecord={newRecord}
      extraHeaderActions={(ctx) => (
        <Button
          onClick={async () => {
            const terminal = await firstValueFrom(terminal$);
            if (!terminal) return;
            await lastValueFrom(
              from(
                writeDataRecords(terminal, [
                  getDataRecordWrapper('portal_relation')!({
                    external_host_url:
                      'wss://hosts.ntnl.io/?public_key=EHNwqvYjXf2u93npXJyKvHtUfgz6kB4jZqjM6yqebFMW&signature=5aaVLciWHUABSA91qoRFGDnHiWoF18hfKGu9K4kTWByh55pqXC6fnmTtqH6DZPKk687hmrTmbDhCw1sDiehRELqt',
                    type: 'channel',
                    direction: 'export',
                    schema: { const: 'AccountInfo/Fund\\/Fountain\\/Public' },
                  }),
                  getDataRecordWrapper('portal_relation')!({
                    external_host_url:
                      'wss://hosts.ntnl.io/?public_key=EHNwqvYjXf2u93npXJyKvHtUfgz6kB4jZqjM6yqebFMW&signature=5aaVLciWHUABSA91qoRFGDnHiWoF18hfKGu9K4kTWByh55pqXC6fnmTtqH6DZPKk687hmrTmbDhCw1sDiehRELqt',
                    type: 'request',
                    direction: 'export',
                    schema: { const: 'AccountInfo/Fund\\/Fountain\\/Public' },
                  }),
                ]),
              ),
            );
          }}
        />
      )}
    />
  );
});
