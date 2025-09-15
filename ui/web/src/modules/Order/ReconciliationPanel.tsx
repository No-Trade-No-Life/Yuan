import React, { useEffect, useState } from 'react';
import { registerPage } from '../Pages';
import { Interactive } from '../../modules';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { requestSQL } from '@yuants/sql';
import { Button, Switch } from '../Interactive';
import { ITrade } from '@yuants/data-trade';
import { formatTime } from '@yuants/utils';

const Toast = Interactive.Toast;

registerPage('Reconciliation', () => {
  const [mergeTrade, setMergeTrade] = useState(false);
  const [data, setData] = useState<ITrade[]>([]);
  const fetchTradeData = async () => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const sql = `select * from trade order by created_at desc`;
        const result = await requestSQL<ITrade[]>(terminal, sql);
        setData(result);
      }
    } catch (e) {
      console.log('获取交易数据失败', { e });
      Toast.error('获取交易数据失败');
    }
  };

  useEffect(() => {
    fetchTradeData();
  }, []);

  return (
    <>
      <Modules.Interactive.DataView
        topSlot={
          <>
            按分钟合并：
            <Switch checked={mergeTrade} onChange={(v) => setMergeTrade(v)} />
          </>
        }
        data={data}
        columns={[
          {
            header: 'Account',
            accessorKey: 'account_id',
            // f
          },
          {
            header: 'Product',
            accessorKey: 'product_id',
          },
          {
            header: 'Direction',
            accessorKey: 'direction',
          },
          {
            header: 'Volume',
            accessorKey: 'traded_volume',
          },
          {
            header: 'Traded Price',
            accessorKey: 'traded_price',
          },
          {
            header: 'Traded Value',
            accessorKey: 'traded_value',
          },
          {
            header: 'Fee',
            accessorKey: 'fee',
          },
          {
            header: 'Fee Currency',
            accessorKey: 'fee_currency',
          },
          {
            header: 'Created At',
            accessorKey: 'created_at',
            accessorFn: (x) => formatTime(x.created_at ?? 0),
          },
        ]}
      />
    </>
  );
});
