import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Switch, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, UUID } from '@yuants/data-model';
import { writeDataRecords } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { filter, first, mergeMap, tap } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { terminate } from '../Terminals/TerminalListItem';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    trade_copy_relation: ITradeCopyRelation;
  }
}

// TODO: Import
interface ITradeCopyRelation {
  id?: string;
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
  disabled?: boolean;
}

const TYPE = 'trade_copy_relation';

const wrapTradeCopyRelation = (x: ITradeCopyRelation): IDataRecord<ITradeCopyRelation> => {
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

const schemaOnEdit: JSONSchema7 = {
  type: 'object',
  required: ['source_account_id', 'source_product_id', 'target_account_id', 'target_product_id', 'multiple'],
  properties: {
    source_account_id: {
      title: '源账户 ID',
      type: 'string',
      format: 'account_id',
    },
    source_product_id: {
      title: '源品种 ID',
      type: 'string',
    },
    target_account_id: {
      title: '目标账户 ID',
      type: 'string',
      format: 'account_id',
    },
    target_product_id: {
      title: '目标品种 ID',
      type: 'string',
    },
    multiple: {
      title: '倍数',
      type: 'number',
    },
    exclusive_comment_pattern: {
      title: '头寸备注黑名单模式',
      description:
        '[高级] 请填写合法的JS正则表达式。如果头寸匹配了此模式，此头寸不会被跟单。留空表示不过滤。高级配置，请咨询技术支持后妥善配置！',
      type: 'string',
      format: 'regex',
    },
    disabled: {
      type: 'boolean',
    },
  },
};

registerPage('TradeCopyRelationList', () => {
  return (
    <DataRecordView
      TYPE="trade_copy_relation"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<IDataRecord<ITradeCopyRelation>>();
        return [
          columnHelper.accessor('origin.source_account_id', {
            header: () => '源账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.source_product_id', {
            header: () => '源品种 ID',
          }),
          columnHelper.accessor('origin.target_account_id', {
            header: () => '目标账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.target_product_id', {
            header: () => '目标品种 ID',
          }),
          columnHelper.accessor('origin.multiple', {
            header: () => '头寸倍数',
          }),
          columnHelper.accessor('origin.exclusive_comment_pattern', {
            header: () => '根据正则表达式匹配头寸的备注 (黑名单)',
          }),
          columnHelper.accessor('origin.disabled', {
            header: () => '禁用',
            cell: (ctx1) => (
              <Switch
                checked={!!ctx1.getValue()}
                onChange={(v) => {
                  const record = ctx1.row.original;
                  const next = wrapTradeCopyRelation({ ...record.origin, disabled: v });
                  terminal$
                    .pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => writeDataRecords(terminal, [next])),
                      tap({
                        complete: () => {
                          Toast.success(`成功更新数据记录 ${record.id}`);
                          ctx.reloadData();
                        },
                      }),
                    )
                    .subscribe();
                }}
              ></Switch>
            ),
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
      mapOriginToDataRecord={wrapTradeCopyRelation}
      schema={schemaOnEdit}
    />
  );
});

registerCommand('TradeCopier.Restart', () => {
  terminate('TradeCopier');
});
