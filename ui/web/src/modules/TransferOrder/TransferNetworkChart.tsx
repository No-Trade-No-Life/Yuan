import { IconRefresh } from '@douyinfe/semi-icons';
import { Space, Switch } from '@douyinfe/semi-ui';
import { encodePath } from '@yuants/data-model';
import { requestSQL } from '@yuants/sql';
import { IAccountAddressInfo } from '@yuants/transfer';
import EChartsReact from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

registerPage('TransferNetworkChart', () => {
  const [items, setItems] = useState<IAccountAddressInfo[]>([]);
  const [isShowAddress, setShowAddress] = useState(false);

  const option = useMemo(() => {
    const accountIds = new Set<string>();
    const networkIds = new Set<string>();
    const mapNetworkAddressToItem = new Map<string, IAccountAddressInfo>();

    items.forEach((item) => {
      accountIds.add(item.account_id);
      networkIds.add(item.network_id);
      mapNetworkAddressToItem.set(encodePath('Address', item.network_id, item.address), item);
    });

    return {
      series: {
        type: 'graph',
        layout: 'force',
        // animation: false,
        tooltip: {},
        data: [
          ...[...accountIds].map((x) => ({ id: encodePath('AccountId', x), name: x, value: 1 })),
          ...[...networkIds].map((x) => ({
            id: encodePath('NetworkId', x),
            name: x,
            itemStyle: { color: 'red' },
            value: 1,
          })),
          ...(isShowAddress
            ? [...mapNetworkAddressToItem.entries()].map(([k, v]) => ({
                id: k,
                name: v.address,
                itemStyle: { color: 'green' },
                value: 1,
              }))
            : []),
        ],
        label: {
          position: 'right',
        },
        force: {
          initLayout: 'circular',
          //   gravity: 1,
          repulsion: 1000,
          edgeLength: 10,
        },
        roam: true,
        edges: items.flatMap((x) =>
          isShowAddress
            ? [
                {
                  source: encodePath('AccountId', x.account_id),
                  target: encodePath('Address', x.network_id, x.address),
                },
                {
                  source: encodePath('Address', x.network_id, x.address),
                  target: encodePath('NetworkId', x.network_id),
                },
              ]
            : [
                {
                  source: encodePath('AccountId', x.account_id),
                  target: encodePath('NetworkId', x.network_id),
                },
              ],
        ),
      },
    };
  }, [items, isShowAddress]);

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          icon={<IconRefresh />}
          onClick={async () => {
            const terminal = await firstValueFrom(terminal$);
            if (!terminal) return;
            const items = await requestSQL<IAccountAddressInfo[]>(
              terminal,
              `select * from account_address_info`,
            );
            setItems(items);
          }}
        >
          刷新
        </Button>
        <Switch
          checked={isShowAddress}
          onChange={(e) => {
            setShowAddress(e);
          }}
        />
        显示网络地址
      </Space>
      <EChartsReact option={option} style={{ width: '100%', minHeight: 800 }} />
    </Space>
  );
});
