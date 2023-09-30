import { IconExport } from '@douyinfe/semi-icons';
import { Button, Space, Table, Tag } from '@douyinfe/semi-ui';
import { OrderDirection, OrderType } from '@yuants/protocol';
import { stringify } from 'csv-stringify/browser/esm/sync';
import download from 'downloadjs';
import { useObservableState } from 'observable-hooks';
import { registerPage } from '../Pages';
import { orders$ } from './model';

registerPage('OrderListPanel', () => {
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
          导出订单列表到 CSV
        </Button>
      </Space>
      <Table
        dataSource={orders}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: '订单ID', render: (_, order) => order.client_order_id },
          { title: '头寸ID', render: (_, order) => order.position_id },
          { title: '品种', render: (_, order) => order.product_id },
          {
            title: '时间',
            render: (_, order) => new Date((order.timestamp_in_us ?? 0) / 1000).toLocaleString(),
          },
          {
            title: '方向',
            render: (_, order) => {
              return (
                <Tag>
                  {
                    {
                      //
                      [OrderDirection.OPEN_LONG]: '开多',
                      [OrderDirection.CLOSE_LONG]: '平多',
                      [OrderDirection.OPEN_SHORT]: '开空',
                      [OrderDirection.CLOSE_SHORT]: '平空',
                    }[order.direction]
                  }
                </Tag>
              );
            },
          },
          {
            title: '类型',
            render: (_, order) => {
              return (
                <Tag>
                  {
                    {
                      //
                      [OrderType.MARKET]: '市价单',
                      [OrderType.LIMIT]: '限价单',
                      [OrderType.STOP]: '触发单',
                      [OrderType.FOK]: 'FOK',
                      [OrderType.IOC]: 'IOC',
                    }[order.type]
                  }
                </Tag>
              );
            },
          },
          { title: '成交价', dataIndex: 'traded_price' },
          { title: '成交量', dataIndex: 'traded_volume' },
          { title: '委托价', dataIndex: 'price' },
          { title: '委托量', dataIndex: 'volume' },
          { title: '基准货币报价', dataIndex: 'inferred_base_currency_price' },
          { title: '盈亏修正', dataIndex: 'profit_correction' },
          { title: '订单备注', dataIndex: 'comment' },
        ]}
      ></Table>
    </div>
  );
});
