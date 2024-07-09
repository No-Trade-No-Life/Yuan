import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord } from '@yuants/data-model';
import { JSONSchema7 } from 'json-schema';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    general_specific_relation: IGeneralSpecificRelation;
  }
}

// TODO: Import
interface IGeneralSpecificRelation {
  // general_datasource_id 一定是 Y 常量，因此不需要特别存储
  // general_datasource_id: string;
  /** 标准品种ID */
  general_product_id: string; // XAUUSD
  /** 具体数据源 ID */
  specific_datasource_id: string; // TradingView
  /** 具体品种 ID */
  specific_product_id: string; // FX:XAUUSD
}

const wrapGeneralSpecificRelation = (x: IGeneralSpecificRelation): IDataRecord<IGeneralSpecificRelation> => ({
  id: `${x.general_product_id}\n${x.specific_product_id}\n${x.specific_datasource_id}`,
  type: 'general_specific_relation',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {},
  origin: x,
});

const schema: JSONSchema7 = {
  type: 'object',
  title: '标准行情数据维护者配置',
  properties: {
    general_product_id: {
      type: 'string',
      title: '标准品种 ID',
    },
    specific_product_id: {
      type: 'string',
      title: '具体品种 ID',
    },
    specific_datasource_id: {
      type: 'string',
      title: '具体品种数据源 ID',
    },
  },
};

registerPage('GeneralSpecificRelationList', () => {
  return (
    <DataRecordView
      TYPE="general_specific_relation"
      columns={() => {
        const columnHelper = createColumnHelper<IDataRecord<IGeneralSpecificRelation>>();
        return [
          columnHelper.accessor('origin.general_product_id', {
            header: () => '标准品种ID',
          }),
          columnHelper.accessor('origin.specific_datasource_id', {
            header: () => '具体数据源ID',
          }),
          columnHelper.accessor('origin.specific_product_id', {
            header: () => '具体品种ID',
          }),
        ];
      }}
      newRecord={() => {
        return {};
      }}
      mapOriginToDataRecord={wrapGeneralSpecificRelation}
      schema={schema}
    />
  );
});
