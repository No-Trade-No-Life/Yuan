import { IconCode, IconCoinMoneyStroked, IconEdit, IconRefresh, IconUser } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatTime } from '@yuants/data-model';
import { format } from 'date-fns';
import EChartsReact from 'echarts-for-react';
import { parse } from 'jsonc-parser';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useReducer } from 'react';
import { firstValueFrom, from, map, pipe, switchMap } from 'rxjs';
import { useAccountInfo } from '../AccountInfo/model';
import { executeCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';

interface IFundStatement {
  type: string;
  updated_at: string;
  comment?: string;
  /** 更新基金总资产的动作 */
  fund_equity?: {
    equity: number;
  };
  /** 更新投资人信息的动作 */
  order?: {
    name: string;
    /** 净入金 */
    deposit: number;
  };
  investor?: {
    name: string;
    /** 更改税率 */
    tax_rate?: number;
  };
}

type IFundState = {
  created_at: number;
  updated_at: number;
  description: string; // 描述
  /** 总资产 */
  total_assets: number;
  /** 已征税费 */
  total_taxed: number;
  summary_derived: {
    /** 总入金 */
    total_deposit: number;
    /** 总份额 */
    total_share: number;
    /** 总税费 */
    total_tax: number;
    /** 单位净值 */
    unit_price: number;
    /** 存续时间 */
    total_time: number;
    /** 总收益 */
    total_profit: number;
  };
  investors: Record<string, InvestorMeta>; // 投资人数据
  investor_derived: Record<string, InvestorInfoDerived>;
};

type InvestorMeta = {
  /** 姓名 */
  name: string;
  /** 份额 */
  share: number;
  /** 起征点 */
  tax_threshold: number;
  /** 净入金 */
  deposit: number;
  /** 税率 */
  tax_rate: number;
};

/**
 * 投资人信息的计算衍生数据
 */
type InvestorInfoDerived = {
  /** 税前资产 */
  pre_tax_assets: number;
  /** 应税额 */
  taxable: number;
  /** 税费 */
  tax: number;
  /** 税后资产 */
  after_tax_assets: number;
  /** 税后收益 */
  after_tax_profit: number;
  /** 税后收益率 */
  after_tax_profit_rate: number;
  /** 税后份额 */
  after_tax_share: number;

  /** 份额占比 */
  share_ratio: number;
};

const initFundState: IFundState = {
  created_at: 0,
  updated_at: 0,
  description: '',
  total_assets: 0, // 总资产
  total_taxed: 0,
  summary_derived: {
    total_deposit: 0,
    total_share: 0,
    total_tax: 0,
    unit_price: 1,
    total_time: 0,
    total_profit: 0,
  },
  investors: {},
  investor_derived: {},
};

const reduceStatement = (state: IFundState, statement: IFundStatement): IFundState => {
  const nextState = structuredClone(state);
  nextState.updated_at = new Date(statement.updated_at).getTime();
  nextState.description = statement.comment || '';

  if (!nextState.created_at) {
    nextState.created_at = nextState.updated_at;
  }

  // 更新总资产
  if (statement.fund_equity) {
    nextState.total_assets = statement.fund_equity.equity;
  }
  // 投资人订单
  if (statement.order) {
    const deposit = statement.order.deposit;
    const investor = (nextState.investors[statement.order.name] ??= {
      name: statement.order.name,
      deposit: 0,
      share: 0,
      tax_threshold: 0,
      tax_rate: 0,
    });
    investor.deposit += deposit;
    investor.tax_threshold += deposit;
    investor.share += deposit / state.summary_derived.unit_price;
    nextState.total_assets += deposit;
  }
  // 更新投资人信息
  if (statement.investor) {
    // 更新税率
    if (statement.investor.tax_rate) {
      nextState.investors[statement.investor.name].tax_rate = statement.investor.tax_rate;
    }
  }
  // 结税
  if (statement.type === 'taxation') {
    for (const investor of Object.values(nextState.investors)) {
      investor.share = state.investor_derived[investor.name].after_tax_share;
      nextState.total_assets -= state.investor_derived[investor.name].tax;
      investor.tax_threshold = state.investor_derived[investor.name].after_tax_assets;
      nextState.total_taxed += state.investor_derived[investor.name].tax;
    }
  }

  // 计算衍生数据
  {
    nextState.summary_derived.total_share = Object.values(nextState.investors).reduce(
      (acc, cur) => acc + cur.share,
      0,
    );
    nextState.summary_derived.unit_price =
      nextState.summary_derived.total_share === 0
        ? 1
        : nextState.total_assets / nextState.summary_derived.total_share;

    nextState.summary_derived.total_time = nextState.updated_at - nextState.created_at;

    // 投资人衍生数据
    Object.values(nextState.investors).forEach((v) => {
      const share_ratio =
        nextState.summary_derived.total_share !== 0 ? v.share / nextState.summary_derived.total_share : 0;
      const pre_tax_assets = v.share * nextState.summary_derived.unit_price;
      const taxable = pre_tax_assets - v.tax_threshold;
      const tax = Math.max(0, taxable * v.tax_rate);
      const after_tax_assets = pre_tax_assets - tax;
      const after_tax_profit = after_tax_assets - v.deposit;
      const after_tax_profit_rate = after_tax_profit / Math.max(0, v.deposit);
      const after_tax_share = after_tax_assets / nextState.summary_derived.unit_price;
      nextState.investor_derived[v.name] = {
        share_ratio,
        taxable,
        tax,
        pre_tax_assets,
        after_tax_assets,
        after_tax_profit,
        after_tax_profit_rate,
        after_tax_share,
      };
    });

    // 总体衍生数据
    nextState.summary_derived.total_deposit = Object.values(nextState.investors).reduce(
      (acc, cur) => acc + cur.deposit,
      0,
    );
    nextState.summary_derived.total_tax = Object.values(nextState.investor_derived).reduce(
      (acc, cur) => acc + cur.tax,
      0,
    );
    nextState.summary_derived.total_profit =
      nextState.total_assets - nextState.summary_derived.total_deposit + nextState.total_taxed;
  }

  return nextState;
};

registerPage('FundStatements', () => {
  const { filename } = usePageParams();
  const [refreshState, refresh] = useReducer(() => ({}), {});

  const statements = useObservableState(
    useObservable(
      pipe(
        switchMap(() =>
          from(fs.readFile(filename)).pipe(
            //
            map((x): IFundStatement[] => parse(x)),
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

  const currentStatements = useMemo(
    () => statements.filter((x) => new Date(x.updated_at).getTime() < Date.now()),
    [statements],
  );

  const history = useMemo(() => {
    const history: IFundState[] = [];
    currentStatements.forEach((statement) => {
      history.push(reduceStatement(history[history.length - 1] || initFundState, statement));
    });
    return history;
  }, [currentStatements]);

  const state = history[history.length - 1] || initFundState;

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
      columnHelper.accessor('detail.after_tax_profit_rate', {
        header: () => '收益率',
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

  const tableOfInvestors = useReactTable({
    columns: columnsOfInvestor,
    data: investors,
    getCoreRowModel: getCoreRowModel(),
  });

  const columnsOfStatement = useMemo(() => {
    const columnHelper = createColumnHelper<IFundStatement>();
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

  const tableOfStatement = useReactTable({
    columns: columnsOfStatement,
    data: currentStatements,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      sorting: [{ id: 'updated_at', desc: true }],
    },
  });

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

  const tableOfState = useReactTable({
    columns: columnsOfState,
    data: history,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      sorting: [{ id: 'updated_at', desc: true }],
    },
  });

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
      assets_close: number;
    }> = [];
    history.forEach((v) => {
      const last = ret[ret.length - 1];
      const created_at = new Date(v.updated_at).setHours(0, 0, 0, 0);
      const value = v.summary_derived.unit_price;
      if (last && last.created_at === created_at) {
        // Same Period
        last.high = Math.max(last.high, value);
        last.low = Math.min(last.low, value);
        last.difference += value - last.close;
        last.difference_annually = last.difference * 36500;
        last.close = value;
        last.profit_close = v.summary_derived.total_profit;
        last.assets_close = v.total_assets;
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
        });
      }
    });
    return ret;
  }, [history]);

  const dateHeatmapOptions = useMemo(() => {
    const maxValue = equityHistory.reduce((acc, cur) => Math.max(acc, Math.abs(cur.difference_annually)), 0);
    return {
      title: {
        text: '每日年化收益率',
      },
      tooltip: {
        position: 'top',
        formatter: `{c0}`,
        // formatter: function (p: { data: [number, number] }) {
        //   return format(p.data[0], 'yyyy-MM-dd') + ': ' + p.data[1];
        // },
      },
      visualMap: {
        min: -maxValue,
        max: maxValue,
        inRange: {
          color: ['rgba(0, 150, 136, 0.8)', 'white', 'rgba(255,82,82,0.8)'],
        },
        // calculable: true,
        orient: 'horizontal',
        left: 'center',
        top: 'top',
      },
      calendar: [
        {
          range:
            equityHistory.length > 0
              ? [
                  format(equityHistory[0].created_at, 'yyyy-MM-dd'),
                  format(equityHistory[equityHistory.length - 1].created_at, 'yyyy-MM-dd'),
                ]
              : format(Date.now(), 'yyyy'),
        },
      ],
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          calendarIndex: 0,
          data: equityHistory.map((state) => [
            format(state.created_at, 'yyyy-MM-dd'),
            state.difference_annually,
          ]),
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
            const theAccountId = await showForm<string>({
              type: 'string',
              title: '选取账户作为基金净值',
              format: 'account_id',
            });
            const theAccountInfo = await firstValueFrom(useAccountInfo(theAccountId));
            const nextStatements = statements.concat([
              {
                type: 'equity',
                updated_at: formatTime(Date.now()),
                fund_equity: {
                  equity: theAccountInfo.money.equity,
                },
              },
            ]);
            await fs.writeFile(
              filename,
              JSON.stringify(
                nextStatements.sort(
                  (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
                ),
                null,
                2,
              ),
            );
            refresh();
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
              account_id: string;
              timing: string;
            }>({
              type: 'object',
              properties: {
                name: { type: 'string', title: '投资人', examples: Object.keys(state.investors) },
                deposit: { type: 'number', title: '申购额', description: '负数代表赎回额' },
                account_id: { type: 'string', title: '选取账户作为基金净值', format: 'account_id' },
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

            const nextStatements = [...statements];
            if (info.account_id) {
              const equity = (await firstValueFrom(useAccountInfo(info.account_id))).money.equity;
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
              updated_at: formatTime(Date.now()),
              order: {
                name: info.name,
                deposit: info.deposit,
              },
            });
            await fs.writeFile(
              filename,
              JSON.stringify(
                nextStatements.sort(
                  (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
                ),
                null,
                2,
              ),
            );
            refresh();
            Toast.success('成功');
          }}
        >
          申购/赎回
        </Button>
        <Button
          icon={<IconCoinMoneyStroked />}
          onClick={async () => {
            const nextStatements = statements.concat([
              {
                type: 'taxation',
                updated_at: formatTime(Date.now()),
                comment: 'Taxation',
              },
            ]);
            await fs.writeFile(
              filename,
              JSON.stringify(
                nextStatements.sort(
                  (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
                ),
                null,
                2,
              ),
            );
            refresh();
            Toast.success('成功');
          }}
        >
          征税
        </Button>
      </Space>
      <Descriptions
        data={[
          { key: '更新时间', value: formatTime(state.updated_at) },
          { key: '总资产', value: state.total_assets },
          { key: '总份额', value: state.summary_derived.total_share },
          { key: '单位净值', value: state.summary_derived.unit_price },
          { key: '净入金', value: state.summary_derived.total_deposit },
          { key: '净利润', value: state.summary_derived.total_profit },
          { key: '存续天数', value: state.summary_derived.total_time / 86400_000 },
          { key: '可征税费', value: state.summary_derived.total_tax },
          { key: '已征税费', value: state.total_taxed },
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
      <EChartsReact
        style={{ width: '100%', height: '100%', minHeight: 400 }}
        option={{
          title: {
            text: '净值曲线',
          },
          tooltip: {
            trigger: 'axis',
          },
          xAxis: {
            data: equityHistory.map((v) => format(v.created_at, 'yyyy-MM-dd')),
          },
          yAxis: {
            scale: true,
          },
          series: [
            {
              type: 'candlestick',
              // O-C-L-H
              data: equityHistory.map((v) => [v.open, v.close, v.low, v.high]),
            },
          ],
        }}
      />
      <EChartsReact
        style={{ width: '100%', height: '100%', minHeight: 400 }}
        option={{
          title: {
            text: '每日走势',
          },
          tooltip: {
            trigger: 'axis',
          },
          xAxis: {
            data: equityHistory.map((v) => format(v.created_at, 'yyyy-MM-dd')),
          },
          yAxis: [
            {
              name: '单位净值增量',
              scale: true,
              alignTicks: true,
            },
            {
              name: '净利润增量',
              scale: true,
              alignTicks: true,
            },
            {
              name: '净利润',
              scale: true,
              offset: 80,
              alignTicks: true,
            },
          ],
          series: [
            {
              name: '单位净值增量',
              type: 'line',
              data: equityHistory.map((state) => state.difference),
            },
            {
              name: '净利润增量',
              type: 'bar',
              yAxisIndex: 1,
              data: equityHistory.map(
                (state, idx, arr) => state.profit_close - (arr[idx - 1]?.profit_close ?? 0),
              ),
            },
            {
              name: '净利润',
              type: 'line',
              yAxisIndex: 2,
              data: equityHistory.map((state) => state.profit_close),
            },
          ],
        }}
      />
      <EChartsReact style={{ width: '100%', height: '100%', minHeight: 400 }} option={dateHeatmapOptions} />
      <Collapse defaultActiveKey={'investors'} style={{ width: '100%' }}>
        <Collapse.Panel itemKey="investors" header={'投资人列表'}>
          <DataView table={tableOfInvestors} />
        </Collapse.Panel>
        <Collapse.Panel itemKey="state" header={'基金历史'}>
          <DataView table={tableOfState} />
        </Collapse.Panel>
        <Collapse.Panel itemKey="actions" header={'操作历史'}>
          <DataView table={tableOfStatement} />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
