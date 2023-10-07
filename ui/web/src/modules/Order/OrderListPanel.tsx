import { IconExport } from '@douyinfe/semi-icons';
import { Button, Space, Table, Tag } from '@douyinfe/semi-ui';
import { OrderDirection, OrderType } from '@yuants/protocol';
import { stringify } from 'csv-stringify/browser/esm/sync';
import download from 'downloadjs';
import { useObservableState } from 'observable-hooks';
import { registerPage } from '../Pages';
import { orders$ } from './model';
import { useTranslation } from 'react-i18next';

registerPage('OrderListPanel', () => {
  const { t } = useTranslation('OrderListPanel');
  const orders = useObservableState(orders$);

  const handleExportOrderList = () => {
    download(
      stringify(orders, {
        header: true,
        columns: [
          'exchange_order_id',
          'product_id',
          'timestamp_in_us',
          'direction',
          'type',
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
          { title: t('order_id'), render: (_, order) => order.client_order_id },
          { title: t('position_id'), render: (_, order) => order.position_id },
          { title: t('product_id'), render: (_, order) => order.product_id },
          {
            title: t('timestamp'),
            render: (_, order) => new Date((order.timestamp_in_us ?? 0) / 1000).toLocaleString(),
          },
          {
            title: t('direction'),
            render: (_, order) => {
              return (
                <Tag>
                  {
                    {
                      //
                      [OrderDirection.OPEN_LONG]: t('common:order_direction_open_long'),
                      [OrderDirection.CLOSE_LONG]: t('common:order_direction_close_long'),
                      [OrderDirection.OPEN_SHORT]: t('common:order_direction_open_short'),
                      [OrderDirection.CLOSE_SHORT]: t('common:order_direction_close_short'),
                    }[order.direction]
                  }
                </Tag>
              );
            },
          },
          {
            title: t('order_type'),
            render: (_, order) => {
              return (
                <Tag>
                  {
                    {
                      //
                      [OrderType.MARKET]: t('market'),
                      [OrderType.LIMIT]: t('limit'),
                      [OrderType.STOP]: t('stop'),
                      [OrderType.FOK]: 'FOK',
                      [OrderType.IOC]: 'IOC',
                    }[order.type]
                  }
                </Tag>
              );
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
