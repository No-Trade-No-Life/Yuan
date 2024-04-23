import { IconExport } from '@douyinfe/semi-icons';
import { Button, Space, Table, Tag } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { stringify } from 'csv-stringify/browser/esm/sync';
import download from 'downloadjs';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
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
      <Table
        dataSource={orders}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: t('account_id'), render: (_, order) => order.account_id },
          { title: t('order_id'), render: (_, order) => order.order_id },
          { title: t('position_id'), render: (_, order) => order.position_id },
          { title: t('product_id'), render: (_, order) => order.product_id },
          {
            title: t('timestamp'),
            render: (_, order) => formatTime(order.submit_at!),
          },
          {
            title: t('direction'),
            render: (_, order) => {
              return <Tag>{order.order_direction}</Tag>;
            },
          },
          {
            title: t('order_type'),
            render: (_, order) => {
              return <Tag>{order.order_type}</Tag>;
            },
          },
          { title: t('traded_price'), dataIndex: 'traded_price' },
          { title: t('traded_volume'), dataIndex: 'traded_volume' },
          { title: t('price'), dataIndex: 'price' },
          { title: t('volume'), dataIndex: 'volume' },
          { title: t('inferred_base_currency_price'), dataIndex: 'inferred_base_currency_price' },
          { title: t('profit_correction'), dataIndex: 'profit_correction' },
          { title: t('comment'), dataIndex: 'comment' },
        ]}
      ></Table>
    </div>
  );
});
