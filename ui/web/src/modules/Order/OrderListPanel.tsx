import { IconExport } from '@douyinfe/semi-icons';
import { Button, Space } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { stringify } from 'csv-stringify/browser/esm/sync';
import download from 'downloadjs';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { orders$ } from './model';

registerPage('OrderListPanel', () => {
  const { t } = useTranslation('OrderListPanel');
  const orders = useObservableState(orders$);

  const handleExportOrderList = () => {
    download(
      stringify(orders, {
        header: true,
        columns: [
          'order_id',
          'product_id',
          'submit_at',
          'order_direction',
          'order_type',
          'traded_price',
          'traded_volume',
          'price',
          'volume',
          'profit_correction',
          'comment',
        ],
      }),
      'orders.csv',
      'text/csv',
    );
  };

  return (
    <div>
      <Space>
        <Button icon={<IconExport />} onClick={handleExportOrderList}>
          {t('export_as_csv')}
        </Button>
      </Space>
      <DataView
        data={orders}
        columns={[
          //
          { header: t('account_id'), accessorKey: 'account_id' },
          { header: t('order_id'), accessorKey: 'order_id' },
          { header: t('position_id'), accessorKey: 'position_id' },
          { header: t('product_id'), accessorKey: 'product_id' },
          {
            header: t('timestamp'),
            accessorKey: 'submit_at',
            cell: (ctx) => formatTime(ctx.getValue()!),
          },
          {
            header: t('direction'),
            accessorKey: 'order_direction',
          },
          {
            header: t('order_type'),
            accessorKey: 'order_type',
          },
          { header: t('traded_price'), accessorKey: 'traded_price' },
          { header: t('traded_volume'), accessorKey: 'traded_volume' },
          { header: t('price'), accessorKey: 'price' },
          { header: t('volume'), accessorKey: 'volume' },
          { header: t('inferred_base_currency_price'), accessorKey: 'inferred_base_currency_price' },
          { header: t('profit_correction'), accessorKey: 'profit_correction' },
          { header: t('comment'), accessorKey: 'comment' },
        ]}
      />
    </div>
  );
});
