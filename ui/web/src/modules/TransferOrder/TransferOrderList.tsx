import { Space, Steps, Toast, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { ITransferOrder } from '@yuants/transfer';
import { UUID, formatTime } from '@yuants/utils';
import { first, firstValueFrom } from 'rxjs';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import { registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { showForm } from '../Form';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<ITransferOrder>();
    return [
      columnHelper.accessor('order_id', {
        header: () => '订单ID',
      }),
      columnHelper.accessor('created_at', {
        header: () => '创建时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('updated_at', {
        header: () => '更新时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('credit_account_id', {
        header: () => '贷方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('debit_account_id', {
        header: () => '借方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('expected_amount', {
        header: () => '初始金额',
      }),
      columnHelper.accessor('currency', {
        header: () => '货币',
      }),
      columnHelper.accessor('status', {
        header: () => '状态',
      }),
      columnHelper.accessor('routing_path', {
        header: () => '转账路径',
        cell: (ctx) => {
          const value = ctx.getValue();
          if (typeof value === 'string') return value;
          const item = ctx.row.original;
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
      columnHelper.accessor('current_tx_account_id', {
        header: () => '当前转账账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue() || ''} />,
      }),
      columnHelper.accessor('current_tx_state', {
        header: () => '当前转账方状态',
      }),
      columnHelper.accessor('current_network_id', {
        header: () => '当前转账网络',
      }),
      columnHelper.accessor('current_rx_account_id', {
        header: () => '当前收账账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue() || ''} />,
      }),
      columnHelper.accessor('current_rx_state', {
        header: () => '当前收账方状态',
      }),
      columnHelper.accessor('current_amount', {
        header: () => '当前金额',
      }),
      columnHelper.accessor('current_transaction_id', {
        header: () => '当前转账凭证号',
      }),
      columnHelper.accessor('error_message', {
        header: () => '错误信息',
      }),
    ];
  };
}

registerPage('TransferOrderList', () => {
  return <DataRecordView TYPE="transfer_order" columns={defineColumns()} />;
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

  await requestSQL(
    terminal,
    buildInsertManyIntoTableSQL(
      [
        {
          order_id: UUID(),
          created_at: formatTime(Date.now()),
          updated_at: formatTime(Date.now()),
          credit_account_id: res.credit_account_id,
          debit_account_id: res.debit_account_id,
          status: 'INIT',
          currency,
          expected_amount: res.amount,
          timeout_at: Date.now() + 86400_000,
        },
      ],
      'transfer_order',
    ),
  );
});
