import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, UUID } from '@yuants/data-model';
import { JSONSchema7 } from 'json-schema';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    trade_copier_trade_config: ITradeCopierTradeConfig;
  }
}

interface ITradeCopierTradeConfig {
  id?: string;
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
}

const schemaOnEdit: JSONSchema7 = {
  type: 'object',
  properties: {
    account_id: {
      title: '账户 ID',
      type: 'string',
      format: 'account_id',
    },
    product_id: {
      title: '品种 ID',
      type: 'string',
    },
    max_volume_per_order: {
      title: '单笔最大手数',
      type: 'number',
    },
  },
};

const TYPE = 'trade_copier_trade_config';

const mapTradeCopierTradeConfigToDataRecord = (
  x: ITradeCopierTradeConfig,
): IDataRecord<ITradeCopierTradeConfig> => {
  const id = x.id || UUID();
  return {
    id,
    type: TYPE,
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: { ...x, id },
  };
};

registerPage('TradeConfigList', () => {
  return (
    <DataRecordView
      TYPE="trade_copier_trade_config"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<IDataRecord<ITradeCopierTradeConfig>>();
        return [
          columnHelper.accessor('origin.account_id', {
            header: () => '账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.product_id', {
            header: () => '品种 ID',
          }),
          columnHelper.accessor('origin.max_volume_per_order', {
            header: () => '每单最大手数',
          }),
        ];
      }}
      newRecord={() => {
        return {};
      }}
      extraHeaderActions={() => {
        return (
          <Button icon={<IconRefresh />} onClick={() => executeCommand('TradeCopier.Restart')}>
            重启跟单阵列
          </Button>
        );
      }}
      mapOriginToDataRecord={mapTradeCopierTradeConfigToDataRecord}
      schema={schemaOnEdit}
    />
  );
});
