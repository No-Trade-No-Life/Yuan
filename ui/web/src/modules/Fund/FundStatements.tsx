import {
  IconCode,
  IconCoinMoneyStroked,
  IconDownload,
  IconEdit,
  IconRefresh,
  IconUpload,
  IconUser,
} from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { parse } from 'jsonc-parser';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useReducer } from 'react';
import { firstValueFrom, from, map, pipe, switchMap } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { useAccountInfo } from '../AccountInfo/model';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { ITimeSeriesChartConfig } from '../Chart/components/model';
import { loadObjectArrayData } from '../Chart/components/utils';
import { executeCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { registerAssociationRule } from '../System';
import { useTerminal } from '../Terminals';
import { IFundEvent } from './model';
import { scanFundEvents } from './utils';

registerAssociationRule({
  id: 'FundStatements',
  match: ({ path, isFile }) => isFile && !!path.match(/\.statements\.json$/),
  action: ({ path }) => {
    executeCommand('FundStatements', { filename: path });
  },
});

registerPage('FundStatements', () => {
  const terminal = useTerminal();
  const { filename } = usePageParams();
  const [refreshState, refresh] = useReducer(() => ({}), {});

  const events = useObservableState(
    useObservable(
      pipe(
        switchMap(() =>
          from(fs.readFile(filename)).pipe(
            //
            map((x): IFundEvent[] => parse(x)),
            map((arr) =>
              arr.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
            ),
          ),
        ),
      ),
      [filename, refreshState],
    ),
    [],
  );

  const saveStatementsToFile = async (events: IFundEvent[]) => {
    await fs.writeFile(
      filename,
      JSON.stringify(
        events.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
        null,
        2,
      ),
    );
    refresh();
  };

  const currentStatements = useMemo(
    () => events.filter((x) => new Date(x.updated_at).getTime() < Date.now()),
    [events],
  );

  const history = useMemo(() => scanFundEvents(currentStatements), [currentStatements]);

  const state = history[history.length - 1];

  const investors = useMemo(
    () => Object.values(state.investors).map((meta) => ({ meta, detail: state.investor_derived[meta.name] })),
    [state],
  );

  const equityHistory = useMemo(() => {
    const ret: Array<{
      created_at: number;
      open: number;
      high: number;
      low: number;
      close: number;
      difference: number;
      difference_annually: number;
      profit_close: number;
      delta_profit_close: number;
      assets_close: number;
      max_value: number;
      drawdown: number;
      max_drawdown: number;
    }> = [];
    history.forEach((v) => {
      const last = ret[ret.length - 1];
      const created_at = new Date(v.updated_at).setHours(0, 0, 0, 0);
      const value = v.summary_derived.unit_price;
      const max_value = Math.max(last ? last.max_value : 0, value);
      const drawdown = max_value - value;
      const max_drawdown = Math.max(last ? last.max_drawdown : 0, drawdown);
      if (last && last.created_at === created_at) {
        // Same Period
        last.high = Math.max(last.high, value);
        last.low = Math.min(last.low, value);
        last.difference += value - last.close;
        last.difference_annually = last.difference * 36500;
        last.close = value;
        last.profit_close = v.summary_derived.total_profit;
        last.assets_close = v.total_assets;
        last.max_value = max_value;
        last.drawdown = drawdown;
        last.max_drawdown = max_drawdown;
        last.delta_profit_close = v.summary_derived.total_profit - (ret[ret.length - 2]?.profit_close ?? 0);
      } else {
        const difference = last ? value - last.close : 0;
        // New Period
        ret.push({
          created_at,
          open: value,
          high: value,
          low: value,
          close: value,
          difference: difference,
          difference_annually: difference * 36500,
          profit_close: v.summary_derived.total_profit,
          assets_close: v.total_assets,
          max_value,
          drawdown,
          max_drawdown,
          delta_profit_close: v.summary_derived.total_profit - (last ? last.profit_close : 0),
        });
      }
    });
    return ret;
  }, [history]);

  const config = useMemo((): ITimeSeriesChartConfig => {
    return {
      data: [
        {
          ...loadObjectArrayData(equityHistory, 'created_at'),
          type: 'data',
          name: 'Internal',
        },
      ],
      views: [
        {
          name: '净值走势',
          time_ref: {
            data_index: 0,
            column_name: 'created_at',
          },
          panes: [
            {
              series: [
                {
                  type: 'ohlc',
                  name: '单位净值',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'open',
                    },
                    {
                      data_index: 0,
                      column_name: 'high',
                    },
                    {
                      data_index: 0,
                      column_name: 'low',
                    },
                    {
                      data_index: 0,
                      column_name: 'close',
                    },
                  ],
                },
              ],
              height_weight: 5,
            },
            {
              series: [
                {
                  type: 'line',
                  name: '单位净值增量',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'difference',
                    },
                  ],
                },
              ],
            },
            {
              series: [
                {
                  type: 'line',
                  name: '净利润',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'profit_close',
                    },
                  ],
                },
              ],
            },
            {
              series: [
                {
                  type: 'hist',
                  name: '净利润增量',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'delta_profit_close',
                    },
                  ],
                },
              ],
            },
            {
              series: [
                {
                  type: 'line',
                  name: '每日年化收益率',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'difference_annually',
                    },
                  ],
                },
              ],
            },
            {
              series: [
                {
                  type: 'line',
                  name: '总资产',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'assets_close',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }, [equityHistory]);

  const drawdown = equityHistory[equityHistory.length - 1]?.drawdown ?? 0;
  const isAllTimeHigh = drawdown === 0 && equityHistory.length > 0;

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space style={{ width: '100%', visibility: terminal ? undefined : 'hidden' }} wrap>
        <Button icon={<IconCode />} onClick={() => executeCommand('FileEditor', { filename })}>
          源码
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={async () => {
            refresh();
            Toast.success('成功');
          }}
        >
          刷新
        </Button>
        <Button
          icon={<IconEdit />}
          onClick={async () => {
            const theAccountId =
              state.account_id ||
              (await showForm<string>({
                type: 'string',
                title: '选取账户作为基金净值',
                format: 'account_id',
              }));
            const theAccountInfo = await firstValueFrom(useAccountInfo(theAccountId));
            const nextStatements = events.concat([
              {
                type: 'equity',
                updated_at: formatTime(Date.now()),
                fund_equity: {
                  equity: theAccountInfo.money.equity,
                },
              },
            ]);
            await saveStatementsToFile(nextStatements);
            Toast.success('成功');
          }}
        >
          记录净值
        </Button>
        <Button
          icon={<IconUser />}
          onClick={async () => {
            const info = await showForm<{
              name: string;
              deposit: number;
              is_record_equity: boolean;
              timing: string;
            }>({
              type: 'object',
              properties: {
                name: { type: 'string', title: '投资人', examples: Object.keys(state.investors) },
                deposit: { type: 'number', title: '申购额', description: '负数代表赎回额' },
                is_record_equity: {
                  type: 'boolean',
                  title: '是否记录净值',
                  description: '如果选择是, 则会在申购/赎回时记录一次净值',
                  default: true,
                },
                timing: {
                  type: 'string',
                  title: '申购赎回时机',
                  description:
                    '事前 (PRE) 表示申购赎回发生在入账之前; 事后 (POST) 表示申购赎回发生在入账之后;',
                  enum: ['PRE', 'POST'],
                  default: 'PRE',
                },
              },
            });

            const nextStatements = [...events];
            if (info.is_record_equity) {
              const equity = (await firstValueFrom(useAccountInfo(state.account_id))).money.equity;
              if (info.timing === 'POST') {
                nextStatements.push({
                  type: 'equity',
                  updated_at: formatTime(Date.now()),
                  fund_equity: {
                    equity: equity - info.deposit,
                  },
                });
              }
              if (info.timing === 'PRE') {
                nextStatements.push({
                  type: 'equity',
                  updated_at: formatTime(Date.now()),
                  fund_equity: {
                    equity: equity,
                  },
                });
              }
            }
            nextStatements.push({
              type: 'order',
              updated_at: formatTime(Date.now() + 1),
              order: {
                name: info.name,
                deposit: info.deposit,
              },
            });
            await saveStatementsToFile(nextStatements);
            Toast.success('成功');
          }}
        >
          申购/赎回
        </Button>
        <Button
          icon={<IconCoinMoneyStroked />}
          onClick={async () => {
            const type = await showForm<string>({
              type: 'string',
              oneOf: [
                {
                  const: 'taxation',
                  title: '征税V1: 税费从基金资产中扣除',
                },
                {
                  const: 'taxation/v2',
                  title: '征税V2: 转移税后份额至 @tax 账户',
                },
              ],
            });
            await saveStatementsToFile(
              events.concat([
                {
                  type: type,
                  updated_at: formatTime(Date.now()),
                  comment: type,
                },
              ]),
            );
            Toast.success('成功');
          }}
        >
          征税
        </Button>
        <Button
          onClick={async () => {
            const info = await showForm<{ name: string; tax_threshold: number }>({
              type: 'object',
              title: '申报免税额',
              required: ['name', 'tax_threshold'],
              properties: {
                name: { type: 'string', title: '投资人', examples: Object.keys(state.investors) },
                tax_threshold: { type: 'number', title: '免税额' },
              },
            });
            await saveStatementsToFile(
              events.concat([
                {
                  type: 'investor',
                  updated_at: formatTime(Date.now()),
                  investor: {
                    name: info.name,
                    add_tax_threshold: info.tax_threshold,
                  },
                  comment: `申报免税额 ${info.tax_threshold}`,
                },
              ]),
            );
            Toast.success('成功');
          }}
        >
          申报免税额
        </Button>
        <Button
          icon={<IconUpload />}
          disabled={!terminal}
          onClick={async () => {
            if (!terminal) return;
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL(
                [
                  {
                    account_id: state.account_id,
                    events: events,
                  },
                ],
                'fund_event',
                { conflictKeys: ['account_id'] },
              ),
            );
            Toast.success('成功');
          }}
        >
          上传到主机
        </Button>
        <Button
          icon={<IconDownload />}
          disabled={!terminal || !state.account_id}
          onClick={async () => {
            if (!terminal) return;
            if (!state.account_id) return;

            const items = await requestSQL<{ events: IFundEvent[] }[]>(
              terminal,
              `SELECT events FROM fund_event WHERE account_id = ${escapeSQL(state.account_id)}`,
            );

            await saveStatementsToFile(items[0].events);
            Toast.success('成功');
          }}
        >
          从主机下载
        </Button>
      </Space>
      <Collapse defaultActiveKey={['summary', 'charts', 'investors']} style={{ width: '100%' }}>
        <Collapse.Panel itemKey="summary" header={'总览'}>
          <DataView
            initialTopSlotVisible={false}
            data={[
              // 一行数据作为 DataView 的数据源，以展示基金的总览信息 (自适应屏幕宽度)
              {
                account_id: state.account_id,
                updated_at: state.updated_at,
                total_assets: state.total_assets,
                total_share: state.summary_derived.total_share,
                total_deposit: state.summary_derived.total_deposit,
                total_profit: state.summary_derived.total_profit,
                total_tax: state.summary_derived.total_tax,
                total_taxed: state.total_taxed,
                unit_price: state.summary_derived.unit_price,
                total_time: state.summary_derived.total_time / 86400_000,
                daily_return: `${
                  ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
                  100
                }%`,
                monthly_return: `${
                  ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
                  100 *
                  30
                }%`,
                annually_return: `${
                  ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
                  100 *
                  365
                }%`,
                max_value: equityHistory[equityHistory.length - 1]?.max_value ?? 0,
                current_drawdown: isAllTimeHigh ? '🔥 ALL-TIME-HIGH 🔥' : drawdown,
                max_drawdown: equityHistory[equityHistory.length - 1]?.max_drawdown ?? 0,
                return_drawdown_ratio: `${
                  (((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
                    365) /
                  (equityHistory[equityHistory.length - 1]?.max_drawdown ?? 0)
                }`,
              },
            ]}
            columns={[
              {
                header: '基金账户',
                accessorKey: 'account_id',
                cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
              },
              { header: '更新时间', accessorKey: 'updated_at', cell: (ctx) => formatTime(ctx.getValue()) },
              { header: '总资产', accessorKey: 'total_assets' },
              { header: '总份额', accessorKey: 'total_share' },
              { header: '净入金', accessorKey: 'total_deposit' },
              { header: '净利润', accessorKey: 'total_profit' },
              { header: '可征税费', accessorKey: 'total_tax' },
              { header: '已征税费', accessorKey: 'total_taxed' },
              { header: '单位净值', accessorKey: 'unit_price' },
              { header: '存续天数', accessorKey: 'total_time' },
              { header: '日化收益率', accessorKey: 'daily_return' },
              { header: '月化收益率', accessorKey: 'monthly_return' },
              { header: '年化收益率', accessorKey: 'annually_return' },
              { header: '最大净值', accessorKey: 'max_value' },
              { header: '当前回撤', accessorKey: 'current_drawdown' },
              { header: '最大回撤', accessorKey: 'max_drawdown' },
              { header: '收益回撤比', accessorKey: 'return_drawdown_ratio' },
            ]}
          />
        </Collapse.Panel>
        <Collapse.Panel itemKey="charts" header={'图表'}>
          <div style={{ height: 800, width: '100%' }}>
            <TimeSeriesChart config={config} />
          </div>
        </Collapse.Panel>
        <Collapse.Panel itemKey="investors" header={'投资人列表'}>
          <DataView
            initialPageSize={200}
            columns={[
              {
                header: '投资人',
                accessorKey: 'meta.name',
              },

              {
                header: '净资产',
                accessorKey: 'detail.after_tax_assets',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '净入金',
                accessorKey: 'meta.deposit',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              // {
              //   header: '推荐人',
              //   accessorKey: 'meta.referrer',
              // },
              // {
              //   header: '推荐人返佣比例',
              //   accessorKey: 'meta.referrer_rebate_rate',
              //   cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
              // },
              // {
              //   header: '已领取的推荐人返佣',
              //   accessorKey: 'meta.claimed_referrer_rebate',
              // },
              // {
              //   header: '已交税费',
              //   accessorKey: 'meta.taxed',
              // },
              {
                header: '收益',
                accessorKey: 'detail.after_tax_profit',
                enableColumnFilter: false,
                enableGlobalFilter: false,
                cell: (ctx) => +ctx.getValue().toFixed(8),
              },
              {
                header: '持有天数',
                accessorKey: 'detail.holding_days',
                enableColumnFilter: false,
                enableGlobalFilter: false,
                cell: (ctx) => `${Math.ceil(ctx.getValue())}`,
              },
              {
                header: '收益率',
                accessorKey: 'detail.after_tax_profit_rate',
                enableColumnFilter: false,
                enableGlobalFilter: false,
                cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
              },
              {
                header: '份额',
                accessorKey: 'meta.share',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '份额占比',
                accessorKey: 'detail.share_ratio',
                enableColumnFilter: false,
                enableGlobalFilter: false,
                cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
              },
              {
                header: '税前资产',
                accessorKey: 'detail.pre_tax_assets',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '起征点',
                accessorKey: 'meta.tax_threshold',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '应税额',
                accessorKey: 'detail.taxable',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '税率',
                accessorKey: 'meta.tax_rate',
                enableColumnFilter: false,
                enableGlobalFilter: false,
                cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
              },
              {
                header: '税费',
                accessorKey: 'detail.tax',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '税后份额',
                accessorKey: 'detail.after_tax_share',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '已交税费',
                accessorKey: 'meta.taxed',
                enableColumnFilter: false,
                enableGlobalFilter: false,
              },
              {
                header: '操作',
                cell: (ctx) => {
                  const investorName = ctx.row.original.meta.name;
                  return (
                    <Space>
                      <Button
                        onClick={async () => {
                          await saveStatementsToFile(
                            events.concat([
                              {
                                type: 'investor',
                                updated_at: formatTime(Date.now()),
                                investor: {
                                  name: investorName,
                                  add_tax_threshold: ctx.row.original.detail.taxable,
                                },
                                comment: `快捷申报免税 ${ctx.row.original.meta.name} ${ctx.row.original.detail.taxable}`,
                              },
                            ]),
                          );
                        }}
                      >
                        快捷免税申报
                      </Button>
                    </Space>
                  );
                },
              },
            ]}
            columnsDependencyList={[events]}
            data={investors}
            initialSorting={[{ id: 'detail_after_tax_assets', desc: true }]}
          />
        </Collapse.Panel>
        <Collapse.Panel itemKey="state" header={'基金历史'}>
          <DataView
            columns={[
              {
                header: '时间',
                accessorKey: 'updated_at',
                cell: (ctx) => formatTime(ctx.getValue()),
              },
              {
                header: '总资产',
                accessorKey: 'total_assets',
              },
              {
                header: '总份额',
                accessorKey: 'summary_derived.total_share',
              },
              {
                header: '单位净值',
                accessorKey: 'summary_derived.unit_price',
              },
            ]}
            data={history}
            initialSorting={[{ id: 'updated_at', desc: true }]}
          />
        </Collapse.Panel>
        <Collapse.Panel itemKey="actions" header={'操作历史'}>
          <DataView
            columns={[
              {
                header: '时间',
                accessorKey: 'updated_at',
                cell: (ctx) => formatTime(ctx.getValue()),
              },
              {
                header: '类型',
                accessorKey: 'type',
              },
              {
                header: '投资人',
                accessorKey: 'order.name',
              },
              {
                header: '净入金',
                accessorKey: 'order.deposit',
              },
              {
                header: '基金总资产',
                accessorKey: 'fund_equity.equity',
              },
              {
                header: '备注',
                accessorKey: 'comment',
              },
            ]}
            data={currentStatements}
            initialSorting={[{ id: 'updated_at', desc: true }]}
          />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
