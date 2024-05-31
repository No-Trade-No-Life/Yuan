import { Space, Steps, Toast, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { ITransferOrder, UUID, formatTime } from '@yuants/data-model';
import { IDataRecord } from '@yuants/protocol';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { schema } from './model';
import { registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { concatWith, first, firstValueFrom, of } from 'rxjs';
import { terminal$ } from '../Terminals';

const TYPE = 'transfer_order';

const mapOriginToDataRecord = (x: ITransferOrder): IDataRecord<ITransferOrder> => {
  const id = x.order_id;
  return {
    id,
    type: TYPE,
    created_at: x.created_at,
    updated_at: x.updated_at,
    frozen_at: null,
    tags: {
      credit_account_id: x.credit_account_id,
      debit_account_id: x.debit_account_id,
      status: `${x.status}`,
    },
    origin: x,
  };
};

function newRecord(): Partial<ITransferOrder> {
  return {
    order_id: UUID(),
    created_at: Date.now(),
  };
}

function beforeUpdateTrigger(x: ITransferOrder) {
  x.updated_at = Date.now();
}

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<IDataRecord<ITransferOrder>>();
    return [
      columnHelper.accessor('origin.order_id', {
        header: () => '订单ID',
      }),
      columnHelper.accessor('origin.created_at', {
        header: () => '创建时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.updated_at', {
        header: () => '更新时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.credit_account_id', {
        header: () => '贷方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.debit_account_id', {
        header: () => '借方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.expected_amount', {
        header: () => '初始金额',
      }),
      columnHelper.accessor('origin.currency', {
        header: () => '货币',
      }),
      columnHelper.accessor('origin.status', {
        header: () => '状态',
      }),
      columnHelper.accessor('origin.routing_path', {
        header: () => '转账路径',
        cell: (ctx) => {
          const value = ctx.getValue();
          if (typeof value === 'string') return value;
          const item = ctx.row.original.origin;
          const index =
            item.status === 'COMPLETE' ? item.routing_path?.length ?? 0 : item.current_routing_index ?? 0;

          if (Array.isArray(value)) {
            return (
              <Steps direction="vertical" type="basic">
                {value.map((e, idx) => (
                  <Steps.Step
                    title={e.network_id}
                    status={
                      idx < index
                        ? 'finish'
                        : idx > index
                        ? 'wait'
                        : item.status === 'ERROR'
                        ? 'error'
                        : 'process'
                    }
                    description={
                      <Space vertical align="start">
                        <Typography.Paragraph>
                          从 <InlineAccountId account_id={e.tx_account_id || ''} /> ({e.tx_address})
                        </Typography.Paragraph>
                        <Typography.Paragraph>
                          到 <InlineAccountId account_id={e.rx_account_id || ''} /> ({e.rx_address})
                        </Typography.Paragraph>
                      </Space>
                    }
                  />
                ))}
              </Steps>
            );
          }
        },
      }),
      columnHelper.accessor('origin.current_tx_account_id', {
        header: () => '当前转账账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue() || ''} />,
      }),
      columnHelper.accessor('origin.current_tx_state', {
        header: () => '当前转账方状态',
      }),
      columnHelper.accessor('origin.current_network_id', {
        header: () => '当前转账网络',
      }),
      columnHelper.accessor('origin.current_rx_account_id', {
        header: () => '当前收账账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue() || ''} />,
      }),
      columnHelper.accessor('origin.current_rx_state', {
        header: () => '当前收账方状态',
      }),
      columnHelper.accessor('origin.current_amount', {
        header: () => '当前金额',
      }),
      columnHelper.accessor('origin.current_transaction_id', {
        header: () => '当前转账凭证号',
      }),
      columnHelper.accessor('origin.error_message', {
        header: () => '错误信息',
      }),
    ];
  };
}

registerPage('TransferOrderList', () => {
  return (
    <DataRecordView
      TYPE={TYPE}
      schema={schema}
      columns={defineColumns()}
      newRecord={newRecord}
      beforeUpdateTrigger={beforeUpdateTrigger}
      mapOriginToDataRecord={mapOriginToDataRecord}
    />
  );
});

registerCommand('Transfer', async (params: {}) => {
  const terminal = await firstValueFrom(terminal$);
  if (!terminal) {
    Toast.error('未连接到主机');
    return;
  }
  const res = await showForm<{ credit_account_id: string; debit_account_id: string; amount: number }>(
    {
      type: 'object',
      required: ['credit_account_id', 'debit_account_id', 'amount'],
      properties: {
        credit_account_id: {
          title: '贷方账户',
          type: 'string',
          format: 'account_id',
        },
        debit_account_id: {
          title: '借方账户',
          type: 'string',
          format: 'account_id',
        },
        amount: {
          title: '金额',
          type: 'number',
        },
      },
    },
    params,
  );

  const accountInfoCredit = await firstValueFrom(useAccountInfo(res.credit_account_id).pipe(first()));
  const accountInfoDebit = await firstValueFrom(useAccountInfo(res.debit_account_id).pipe(first()));

  const currency = accountInfoCredit.money.currency;
  if (currency !== accountInfoDebit.money.currency) {
    Toast.error(`贷方账户 (${currency}) 与借方账户 (${accountInfoDebit.money.currency}）不一致`);
    return;
  }

  await firstValueFrom(
    terminal
      .updateDataRecords([
        mapOriginToDataRecord({
          order_id: UUID(),
          created_at: Date.now(),
          updated_at: Date.now(),
          credit_account_id: res.credit_account_id,
          debit_account_id: res.debit_account_id,
          status: 'INIT',
          currency,
          expected_amount: res.amount,
          timeout_at: Date.now() + 86400_000,
        }),
      ])
      .pipe(concatWith(of(0))),
  );
});
