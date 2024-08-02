import { StockMarket } from '@icon-park/react';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IProduct } from '@yuants/data-model';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { showForm } from '../Form';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';

registerPage('ProductList', () => {
  return (
    <DataRecordView
      TYPE="product"
      columns={() => {
        const columnHelper = createColumnHelper<IDataRecord<IProduct>>();

        return [
          columnHelper.accessor('origin.datasource_id', {
            header: () => '数据源ID',
          }),
          columnHelper.accessor('origin.product_id', {
            header: () => '品种ID',
          }),
          columnHelper.accessor('origin.name', { header: () => '品种名称' }),
          columnHelper.accessor('origin.quote_currency', { header: () => '计价货币' }),
          columnHelper.accessor('origin.base_currency', { header: () => '基准货币' }),
          columnHelper.accessor((x) => `${x.origin.value_scale || ''} ${x.origin.value_scale_unit || ''}`, {
            id: 'value_scale',
            header: () => '价值尺度',
          }),
          columnHelper.accessor('origin.volume_step', { header: () => '成交量粒度' }),
          columnHelper.accessor('origin.price_step', { header: () => '报价粒度' }),
          columnHelper.accessor('origin.margin_rate', { header: () => '保证金率' }),
          columnHelper.accessor('origin.spread', { header: () => '点差' }),
        ];
      }}
      newRecord={() => {
        return {};
      }}
      extraRecordActions={(props) => {
        const item = props.record.origin;
        return (
          <Button
            icon={<StockMarket />}
            onClick={async () => {
              const period_in_sec = await showForm<string>({ type: 'string', title: 'period_in_sec' });
              if (period_in_sec) {
                executeCommand('Market', {
                  datasource_id: item.datasource_id,
                  product_id: item.product_id,
                  period_in_sec: +period_in_sec,
                });
              }
            }}
          ></Button>
        );
      }}
    />
  );
});
