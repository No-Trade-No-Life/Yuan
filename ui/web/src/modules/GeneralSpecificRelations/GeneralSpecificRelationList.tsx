import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecordTypes } from '@yuants/data-model';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';

registerPage('GeneralSpecificRelationList', () => {
  return (
    <DataRecordView
      TYPE="general_specific_relation"
      columns={() => {
        const columnHelper = createColumnHelper<IDataRecordTypes['general_specific_relation']>();
        return [
          columnHelper.accessor('general_product_id', {
            header: () => '标准品种ID',
          }),
          columnHelper.accessor('specific_datasource_id', {
            header: () => '具体数据源ID',
          }),
          columnHelper.accessor('specific_product_id', {
            header: () => '具体品种ID',
          }),
        ];
      }}
    />
  );
});
