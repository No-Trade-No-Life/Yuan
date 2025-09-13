import { Space, Spin } from '@douyinfe/semi-ui';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { memo } from 'react';
import { EMPTY, Observable, pipe, switchMap } from 'rxjs';
import { schemaOfAccountComposerConfig } from '../AccountComposition';
import { IAccountComposerConfig } from '../AccountComposition/interface';
import { InlineAccountId } from '../AccountInfo';
import { showForm } from '../Form';
import { Button, Switch, Toast } from '../Interactive';
import { terminal$ } from '../Network';
import { useTerminal } from '../Terminals';
import { ITradeCopierConfig } from './interface';
import { schemaOfTradeCopierConfig } from './schema';

const useSQLQuery = function <T>(query: string, refresh$: Observable<void>): T | undefined {
  return useObservableState(
    useObservable(
      pipe(
        switchMap(([query]) =>
          refresh$.pipe(
            switchMap(() =>
              terminal$.pipe(
                switchMap((terminal) => {
                  if (!terminal) return EMPTY;
                  return requestSQL<T>(terminal, query);
                }),
              ),
            ),
          ),
        ),
      ),
      [query],
    ),
  );
};

export const TradeCopierDetail = memo((props: { account_id: string }) => {
  const [, refresh$] = useObservableRef<void>();
  const data = useSQLQuery<ITradeCopierConfig[]>(
    `select * from trade_copier_config where account_id=${escapeSQL(props.account_id)}`,
    refresh$,
  );
  const config = data ? data[0] || { account_id: props.account_id } : undefined;

  const terminal = useTerminal();

  if (!terminal) return <Spin tip={'Connecting...'} />;

  if (!config) return <Spin tip={'Loading Config...'} />;

  const previewAccountId = `TradeCopier/Preview/${props.account_id}`;
  const expectedAccountId = `TradeCopier/Expected/${props.account_id}`;
  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Switch
          checked={config.enabled}
          onChange={async (v) => {
            const nextConfig = structuredClone(config);
            nextConfig.enabled = v;
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL([nextConfig], 'trade_copier_config', {
                conflictKeys: ['account_id'],
              }),
            );
            refresh$.next();
            Toast.success('更新成功');
          }}
        />
        启用跟单
        <Button
          onClick={async () => {
            const data = await requestSQL<IAccountComposerConfig[]>(
              terminal,
              `select * from account_composer_config where account_id=${escapeSQL(previewAccountId)}`,
            );
            const nextConfig = await showForm<IAccountComposerConfig>(
              schemaOfAccountComposerConfig,
              data[0] || { account_id: previewAccountId },
            );
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL([nextConfig], 'account_composer_config', {
                conflictKeys: ['account_id'],
              }),
            );
            refresh$.next();
            Toast.success('编辑预览账户成功');
          }}
        >
          配置预览账户
        </Button>
        <Button
          disabled={!data}
          onClick={async () => {
            const nextConfig = await showForm<ITradeCopierConfig>(schemaOfTradeCopierConfig, config);
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL([nextConfig], 'trade_copier_config', {
                conflictKeys: ['account_id'],
              }),
            );
            refresh$.next();
            Toast.success('编辑跟单配置成功');
          }}
        >
          修改跟单策略
        </Button>
        <Button
          type="danger"
          doubleCheck={{
            title: '发布上线: 将预览账户的数据覆盖预期账户',
            description: `交易跟单器会自动跟随预期账户进行跟单，请确保预览账户配置正确且可用。设置不当可能会导致错误的交易订单，造成资金损失。`,
          }}
          onClick={async () => {
            const data = await requestSQL<ITradeCopierConfig[]>(
              terminal,
              `select * from account_composer_config where account_id=${escapeSQL(previewAccountId)}`,
            );
            if (data.length === 0) {
              Toast.error('预览账户不存在，请先编辑预览账户');
              return;
            }
            data[0].account_id = expectedAccountId;
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL(data, 'account_composer_config', {
                conflictKeys: ['account_id'],
              }),
            );
            refresh$.next();
            Toast.success('发布成功');
          }}
        >
          发布上线
        </Button>
      </Space>
      <div>
        预期账户: <InlineAccountId account_id={expectedAccountId} />
      </div>
      <div>
        预览账户: <InlineAccountId account_id={previewAccountId} />
      </div>
    </Space>
  );
});
