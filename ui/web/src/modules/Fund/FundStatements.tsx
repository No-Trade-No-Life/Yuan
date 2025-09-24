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
import { createColumnHelper } from '@tanstack/react-table';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { parse } from 'jsonc-parser';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useReducer } from 'react';
import { firstValueFrom, from, map, of, pipe, switchMap } from 'rxjs';
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
import { IFundEvent, IFundState, InvestorInfoDerived, InvestorMeta } from './model';
import { getInitFundState, reduceState } from './utils';

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

  const history = useMemo(() => {
    const history: IFundState[] = [];
    currentStatements.forEach((statement) => {
      history.push(reduceState(history[history.length - 1] || getInitFundState(), statement));
    });
    return history;
  }, [currentStatements]);

  const state = useMemo(() => history[history.length - 1] || getInitFundState(), [history]);

  const fundAccountInfo = useObservableState(
    useObservable(pipe(switchMap(([id]) => (id ? useAccountInfo(id) : of(undefined)))), [state.account_id]),
  );

  const investors = useMemo(
    () => Object.values(state.investors).map((meta) => ({ meta, detail: state.investor_derived[meta.name] })),
    [state],
  );

  const columnsOfInvestor = useMemo(() => {
    const columnHelper = createColumnHelper<{
      meta: InvestorMeta;
      detail: InvestorInfoDerived;
    }>();
    return [
      columnHelper.accessor('meta.name', {
        header: () => '投资人',
      }),
      columnHelper.accessor('detail.after_tax_assets', {
        header: () => '净资产',
      }),
      columnHelper.accessor('meta.deposit', {
        header: () => '净入金',
      }),
      columnHelper.accessor('detail.after_tax_profit', {
        header: () => '收益',
      }),
      columnHelper.accessor('detail.holding_days', {
        header: () => '持有天数',
        cell: (ctx) => `${Math.ceil(ctx.getValue())}`,
      }),
      columnHelper.accessor('detail.after_tax_profit_rate', {
        header: () => '简单收益率',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
      }),
      columnHelper.accessor('detail.after_tax_IRR', {
        header: () => '内部收益率',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
      }),
      columnHelper.accessor('meta.share', {
        header: () => '份额',
      }),
      columnHelper.accessor('detail.share_ratio', {
        header: () => '份额占比',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
      }),

      columnHelper.accessor('detail.pre_tax_assets', {
        header: () => '税前资产',
      }),
      columnHelper.accessor('meta.tax_threshold', {
        header: () => '起征点',
      }),
      columnHelper.accessor('detail.taxable', {
        header: () => '应税额',
      }),
      columnHelper.accessor('meta.tax_rate', {
        header: () => '税率',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
      }),
      columnHelper.accessor('detail.tax', {
        header: () => '税费',
      }),
      columnHelper.accessor('detail.after_tax_share', {
        header: () => '税后份额',
      }),
    ];
  }, []);

  const columnsOfStatement = useMemo(() => {
    const columnHelper = createColumnHelper<IFundEvent>();
    return [
      columnHelper.accessor('updated_at', {
        header: () => '时间',
        cell: (ctx) => formatTime(ctx.getValue()),
      }),

      columnHelper.accessor('fund_equity.equity', {
        header: () => '基金总资产',
      }),
      columnHelper.accessor('order.name', {
        header: () => '投资人',
      }),
      columnHelper.accessor('order.deposit', {
        header: () => '净入金',
      }),
      columnHelper.accessor('comment', {
        header: () => '备注',
      }),
    ];
  }, []);

  const columnsOfState = useMemo(() => {
    const columnHelper = createColumnHelper<IFundState>();
    return [
      columnHelper.accessor('updated_at', {
        header: () => '时间',
        cell: (ctx) => formatTime(ctx.getValue()),
      }),

      columnHelper.accessor('total_assets', {
        header: () => '总资产',
      }),
      columnHelper.accessor('summary_derived.total_share', {
        header: () => '总份额',
      }),
      columnHelper.accessor('summary_derived.unit_price', {
        header: () => '单位净值',
      }),
    ];
  }, []);

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

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
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
              timing: string;
            }>({
              type: 'object',
              properties: {
                name: { type: 'string', title: '投资人', examples: Object.keys(state.investors) },
                deposit: { type: 'number', title: '申购额', description: '负数代表赎回额' },
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
            await saveStatementsToFile(
              events.concat([
                {
                  type: 'taxation',
                  updated_at: formatTime(Date.now()),
                  comment: 'Taxation',
                },
              ]),
            );
            Toast.success('成功');
          }}
        >
          征税
        </Button>
        <Button
          icon={<IconUpload />}
          disabled={!terminal}
          onClick={async () => {
            if (!terminal) return;
            await requestSQL(
              terminal,
              buildInsertManyIntoTableSQL(
                [{ account_id: state.account_id, events: JSON.stringify(state.events) }],
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
      <Typography.Text>更新时间: {formatTime(state.updated_at)}</Typography.Text>
      <Typography.Text>
        基金账户: <InlineAccountId account_id={state.account_id} />
      </Typography.Text>
      <Typography.Title heading={4}>资金指标</Typography.Title>
      <Descriptions
        data={[
          { key: '总资产', value: state.total_assets },
          { key: '总份额', value: state.summary_derived.total_share },
          { key: '净入金', value: state.summary_derived.total_deposit },
          { key: '净利润', value: state.summary_derived.total_profit },
          { key: '可征税费', value: state.summary_derived.total_tax },
          { key: '已征税费', value: state.total_taxed },
        ]}
        row
      />
      <Typography.Title heading={4}>性能指标</Typography.Title>
      <Descriptions
        data={[
          { key: '单位净值', value: state.summary_derived.unit_price },
          { key: '存续天数', value: state.summary_derived.total_time / 86400_000 },
          {
            key: '日化收益率',
            value: `${
              ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) * 100
            }%`,
          },
          {
            key: '月化收益率',
            value: `${
              ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
              100 *
              30
            }%`,
          },
          {
            key: '年化收益率',
            value: `${
              ((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
              100 *
              365
            }%`,
          },
        ]}
        row
      />
      <Descriptions
        data={[
          {
            key: '最大净值',
            value: `${equityHistory[equityHistory.length - 1]?.max_value ?? 0}`,
          },
          {
            key: '当前回撤',
            value: `${equityHistory[equityHistory.length - 1]?.drawdown ?? 0}`,
          },
          {
            key: '最大回撤',
            value: `${equityHistory[equityHistory.length - 1]?.max_drawdown ?? 0}`,
          },
          {
            key: '年化收益率 / 最大回撤',
            value: `${
              (((state.summary_derived.unit_price - 1) / (state.summary_derived.total_time / 86400_000)) *
                365) /
              (equityHistory[equityHistory.length - 1]?.max_drawdown ?? 0)
            }`,
          },
        ]}
        row
      />
      <Collapse defaultActiveKey={['charts', 'investors']} style={{ width: '100%' }}>
        <Collapse.Panel itemKey="charts" header={'图表'}>
          <div style={{ height: 800, width: '100%' }}>
            <TimeSeriesChart config={config} />
          </div>
        </Collapse.Panel>
        <Collapse.Panel itemKey="investors" header={'投资人列表'}>
          <DataView
            columns={columnsOfInvestor}
            data={investors}
            initialSorting={[{ id: 'detail_after_tax_assets', desc: true }]}
          />
        </Collapse.Panel>
        <Collapse.Panel itemKey="state" header={'基金历史'}>
          <DataView
            columns={columnsOfState}
            data={history}
            initialSorting={[{ id: 'updated_at', desc: true }]}
          />
        </Collapse.Panel>
        <Collapse.Panel itemKey="actions" header={'操作历史'}>
          <DataView
            columns={columnsOfStatement}
            data={currentStatements}
            initialSorting={[{ id: 'updated_at', desc: true }]}
          />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
