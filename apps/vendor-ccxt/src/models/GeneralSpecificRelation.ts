import { IDataRecord } from '@yuants/data-model';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    general_specific_relation: IGeneralSpecificRelation;
  }
}

export interface IGeneralSpecificRelation {
  // general_datasource_id 一定是 Y 常量，因此不需要特别存储
  // general_datasource_id: string;
  /** 标准品种ID */
  general_product_id: string; // XAUUSD
  /** 具体数据源 ID */
  specific_datasource_id: string; // TradingView
  /** 具体品种 ID */
  specific_product_id: string; // FX:XAUUSD
}

export const wrapGeneralSpecificRelation = (
  gsr: IGeneralSpecificRelation,
): IDataRecord<IGeneralSpecificRelation> => ({
  id: `${gsr.general_product_id}\n${gsr.specific_datasource_id}\n${gsr.specific_product_id}`,
  type: 'general_specific_relation',
  created_at: Date.now(),
  frozen_at: null,
  updated_at: Date.now(),
  tags: {},
  origin: gsr,
});
