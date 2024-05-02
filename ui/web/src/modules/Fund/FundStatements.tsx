import { IconCode, IconEdit, IconRefresh, IconUser } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatTime } from '@yuants/data-model';
import { format } from 'date-fns';
import EChartsReact from 'echarts-for-react';
import { parse } from 'jsonc-parser';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useReducer } from 'react';
import { firstValueFrom, from, map, pipe, switchMap } from 'rxjs';
import { accountIds$, useAccountInfo } from '../AccountInfo/model';
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
}

type IFundState = {
  created_at: number;
  updated_at: number;
  description: string; // 描述
  totalAssets: number; // 总资产
  totalShare: number; // 总份额
  unitPrice: number; // 份额净值
  net_deposit: number; // 净入金
  investors: Record<string, InvestorMeta>; // 投资人数据
  mapNameToDetail: Record<string, InvestorDetails>;
};

type InvestorMeta = {
  // input
  name: string; // 投资人姓名
  share: number; // 投资人份额
  dividendBase: number; // 投资人分红基数
  deposit: number; // 投资人净入金
  dividendRate: number; // 计提分红比率
};

// 投资人数据详情
type InvestorDetails = {
  // by compute
  shareRate: number; // 投资人份额百分比
  assets: number; // 投资人账面资产
  profit: number; // 投资人账面盈利
  profitRate: number; // 投资人账面盈利率
  expectedDividend: number; // 投资人预期计提分红
  expectedDividendShare: number; // 投资人预期分红扣减份额
  expectedPostDividendShare: number; // 投资人预期分红后份额
  expectedPostDividendAssets: number; // 投资人预期分红后资产
  expectedProfit: number; // 投资人预期收益
  expectedProfitRate: number; // 投资人预期收益率
  accumulatedProfit: number; // 投资人累积收益
  accumulatedProfitRate: number; // 投资人累积收益率
};

const initInvestor: InvestorDetails = {
  shareRate: 0,
  assets: 0,
  profit: 0,
  profitRate: 0,
  expectedDividend: 0,
  expectedDividendShare: 0,
  expectedPostDividendShare: 0,
  expectedPostDividendAssets: 0,
  expectedProfit: 0,
  expectedProfitRate: 0,
  accumulatedProfit: 0,
  accumulatedProfitRate: 0,
};

const initFundState: IFundState = {
  created_at: 0,
  updated_at: 0,
  description: '',
  totalAssets: 0, // 总资产
  totalShare: 0, // 总份额
  net_deposit: 0,
  unitPrice: 1, // 份额净值
  investors: {},
  mapNameToDetail: {},
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
    nextState.totalAssets = statement.fund_equity.equity;
  }
  // 投资人订单
  if (statement.order) {
    const deposit = statement.order.deposit;
    const investor = (nextState.investors[statement.order.name] ??= {
      name: statement.order.name,
      dividendBase: 0,
      deposit: 0,
      share: 0,
      dividendRate: 0,
    });
    investor.deposit += deposit;
    investor.dividendBase += deposit;
    investor.share += deposit / state.unitPrice;
    nextState.totalAssets += deposit;
    nextState.net_deposit += deposit;
  }

  {
    const totalShare = Object.values(nextState.investors).reduce((acc, cur) => acc + cur.share, 0); // 总份额
    const unitPrice = totalShare === 0 ? 1 : nextState.totalAssets / totalShare; // 份额净值
    nextState.totalShare = totalShare;
    nextState.unitPrice = unitPrice;
    Object.values(nextState.investors).forEach((v) => {
      const dividendRate = v.dividendRate; // 投资人计提分红比例
      const share = v.share; // 投资人份额
      const dividendBase = v.dividendBase; // 投资人分红基数
      const shareRate = totalShare !== 0 ? share / totalShare : 0; // 投资人份额百分比
      const assets = share * unitPrice; // 投资人账面资产
      const profit = assets - dividendBase; // 投资人账面盈利
      const profitRate = dividendBase !== 0 ? profit / dividendBase : 0; // 投资人账面盈利率
      const expectedDividend = profit > 0 ? profit * dividendRate : 0; // 投资人预期计提分红
      const expectedDividendShare = profit > 0 ? expectedDividend / unitPrice : 0; // 投资人预期分红扣减份额
      const expectedPostDividendShare = share - expectedDividendShare; // 投资人预期分红后份额
      const expectedPostDividendAssets = expectedPostDividendShare * unitPrice; // 投资人预期分红后资产
      const expectedProfit = expectedPostDividendAssets - dividendBase; // 投资人预期收益
      const expectedProfitRate = dividendBase !== 0 ? expectedProfit / dividendBase : 0; // 投资人预期收益率
      const deposit = v.deposit; // 投资人净入金
      const accumulatedProfit = expectedPostDividendAssets - deposit; // 投资人累积收益
      const accumulatedProfitRate = deposit !== 0 ? accumulatedProfit / deposit : 0; // 投资人累积收益率
      nextState.mapNameToDetail[v.name] = {
        shareRate,
        assets,
        profit,
        profitRate,
        expectedDividend,
        expectedDividendShare,
        expectedPostDividendShare,
        expectedPostDividendAssets,
        expectedProfit,
        expectedProfitRate,
        accumulatedProfit,
        accumulatedProfitRate,
      };
    });
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

  const history = useMemo(() => {
    const history: IFundState[] = [];
    statements.forEach((statement) => {
      history.push(reduceStatement(history[history.length - 1] || initFundState, statement));
    });
    return history;
  }, [statements]);

  const state = history[history.length - 1] || initFundState;

  const investors = useMemo(
    () => Object.values(state.investors).map((meta) => ({ meta, detail: state.mapNameToDetail[meta.name] })),
    [state],
  );

  const columnsOfInvestor = useMemo(() => {
    const columnHelper = createColumnHelper<{
      meta: InvestorMeta;
      detail: InvestorDetails;
    }>();
    return [
      columnHelper.accessor('meta.name', {
        header: () => '投资人',
      }),
      columnHelper.accessor('detail.assets', {
        header: () => '净资产',
      }),
      columnHelper.accessor('meta.share', {
        header: () => '份额',
      }),
      columnHelper.accessor('meta.deposit', {
        header: () => '净入金',
      }),
      columnHelper.accessor('detail.accumulatedProfit', {
        header: () => '净收益',
      }),
      columnHelper.accessor('detail.accumulatedProfitRate', {
        header: () => '收益率',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
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
    data: statements,
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

      columnHelper.accessor('totalAssets', {
        header: () => '基金总资产',
      }),
      columnHelper.accessor('totalShare', {
        header: () => '基金总份额',
      }),
      columnHelper.accessor('unitPrice', {
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
    }> = [];
    history.forEach((v) => {
      const last = ret[ret.length - 1];
      const created_at = new Date(v.updated_at).setHours(0, 0, 0, 0);
      const value = v.unitPrice;
      if (last && last.created_at === created_at) {
        // Same Period
        last.high = Math.max(last.high, value);
        last.low = Math.min(last.low, value);
        last.difference += value - last.close;
        last.difference_annually = last.difference * 36500;
        last.close = value;
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
            const accountIds = await firstValueFrom(accountIds$);
            const theAccountId = await showForm<string>({
              type: 'string',
              title: '选取账户作为基金净值',
              enum: accountIds,
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
            await fs.writeFile(filename, JSON.stringify(nextStatements, null, 2));
            refresh();
            Toast.success('成功');
          }}
        >
          记录净值
        </Button>
        <Button
          icon={<IconUser />}
          onClick={async () => {
            const info = await showForm<{ name: string; deposit: number }>({
              type: 'object',
              properties: {
                name: { type: 'string', title: '投资人', examples: Object.keys(state.investors) },
                deposit: { type: 'number', title: '申购额', description: '负数代表赎回额' },
              },
            });
            const nextStatements = statements.concat([
              {
                type: 'order',
                updated_at: formatTime(Date.now()),
                order: {
                  name: info.name,
                  deposit: info.deposit,
                },
              },
            ]);
            await fs.writeFile(filename, JSON.stringify(nextStatements, null, 2));
            refresh();
            Toast.success('成功');
          }}
        >
          申购/赎回
        </Button>
      </Space>
      <Descriptions
        data={[
          { key: '更新时间', value: formatTime(state.updated_at) },
          { key: '总资产', value: state.totalAssets },
          { key: '总份额', value: state.totalShare },
          { key: '单位净值', value: state.unitPrice },
          { key: '净入金', value: state.net_deposit },
          { key: '净利润', value: state.totalAssets - state.net_deposit },
          { key: '存续天数', value: (state.updated_at - state.created_at) / 86400_000 },
          {
            key: '日化收益率',
            value: `${((state.unitPrice - 1) / ((state.updated_at - state.created_at) / 86400_000)) * 100}%`,
          },
          {
            key: '月化收益率',
            value: `${
              ((state.unitPrice - 1) / ((state.updated_at - state.created_at) / 86400_000)) * 100 * 30
            }%`,
          },
          {
            key: '年化收益率',
            value: `${
              ((state.unitPrice - 1) / ((state.updated_at - state.created_at) / 86400_000)) * 100 * 365
            }%`,
          },
          { key: '投资人', value: Object.keys(state.investors).length },
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
            text: '每日盈利',
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
              type: 'line',
              data: equityHistory.map((state) => state.difference),
            },
          ],
        }}
      />
      <EChartsReact style={{ width: '100%', height: '100%', minHeight: 600 }} option={dateHeatmapOptions} />
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
