import { Descriptions, Divider, Table, Tooltip } from '@douyinfe/semi-ui';
import { registerPage } from '../Pages';
import { ClearingAndSettlement } from './ClearingAndSettlement';
import { InvestorDetails, useFinancialReport } from './useFinancialReport';

type InvestorSts = InvestorDetails & {
  key: number;
};

const toCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const toNum =
  (fixed: number) =>
  (value: number | undefined): string => {
    if (value === undefined) return '';
    return value.toFixed(fixed);
  };

const toRate = (value: number): string => {
  return (value * 100).toFixed(2) + '%';
};

const toDisplayWithRate = (amount: string, rate: number): string => {
  return `${amount} (${toRate(rate)})`;
};

registerPage('FinancialStatementsPanel', () => {
  const { history } = useFinancialReport();
  const latest = history[history.length - 1];
  if (!latest) return <>no data</>;

  const recordsCols = [
    {
      title: '时间',
      fixed: true,
      width: 180,
      dataIndex: 'time',
      render: (_: unknown, record: (typeof recordsDisplay)[number]) => (
        <Tooltip position="rightTop" content={record.description}>
          {new Date(record.time).toLocaleString()}
        </Tooltip>
      ),
    },
    { title: '份额合计', fixed: true, width: 120, dataIndex: 'totalShare', render: toNum(2) },
    { title: '份额净值', fixed: true, width: 120, dataIndex: 'unitPrice', render: toNum(6) },
    { title: '总资产', fixed: true, width: 120, dataIndex: 'totalAssets', render: toCurrency },
    ...Object.keys(latest.investors).map((i) => ({ title: i, width: 120, dataIndex: i, render: toNum(2) })),
  ];

  const recordsDisplay = history.map((data, i) => {
    const shareRecords: Record<string, number> = {};
    Object.keys(data.investors).forEach((name) => {
      shareRecords[name] = data.investors[name].share;
    });
    return {
      key: i + 1,
      time: data.time,
      description: data.description,
      totalShare: data.totalShare,
      unitPrice: data.unitPrice,
      totalAssets: data.totalAssets,
      ...shareRecords,
    };
  });

  const metaCols = [
    { title: '投资人', fixed: true, width: 100, dataIndex: 'name' },
    {
      title: '预期分红后资产',
      fixed: true,
      width: 140,
      dataIndex: 'expectedPostDividendAssets',
      render: toCurrency,
    },
    { title: '计提分红比例', width: 120, dataIndex: 'dividendRate', render: toRate },
    {
      title: '份额',
      width: 180,
      dataIndex: 'share',
      render: (_: unknown, record: InvestorSts) =>
        toDisplayWithRate(toNum(2)(record.share), record.shareRate),
    },
    {
      title: '预期收益',
      width: 200,
      dataIndex: 'expectedProfit',
      render: (_: unknown, record: InvestorSts) =>
        toDisplayWithRate(toCurrency(record.expectedProfit), record.expectedProfitRate),
    },
    { title: '分红基数', width: 120, dataIndex: 'dividendBase', render: toCurrency },
    { title: '账面资产', width: 120, dataIndex: 'assets', render: toCurrency },
    {
      title: '账面盈利',
      width: 200,
      dataIndex: 'profit',
      render: (_: unknown, record: InvestorSts) =>
        toDisplayWithRate(toCurrency(record.profit), record.profitRate),
    },
    { title: '预期计提分红', width: 120, dataIndex: 'expectedDividend', render: toCurrency },
    { title: '预期分红扣减份额', width: 120, dataIndex: 'expectedDividendShare', render: toNum(2) },
    { title: '预计分红后份额', width: 120, dataIndex: 'expectedPostDividendShare', render: toNum(2) },
    { title: '净入金', width: 120, dataIndex: 'deposit', render: toCurrency },
    {
      title: '累积收益',
      width: 200,
      dataIndex: 'accumulatedProfit',
      render: (_: unknown, record: InvestorSts) =>
        toDisplayWithRate(toCurrency(record.accumulatedProfit), record.accumulatedProfitRate),
    },
  ];

  const metaDisplay: InvestorSts[] = Object.values(latest.investors).map((d, i) => {
    return {
      key: i + 1,
      ...d,
    };
  });

  const stsCols = [
    { key: '份额合计', value: toNum(2)(latest.totalShare) },
    { key: '份额净值', value: toNum(6)(latest.unitPrice) },
    { key: '资产合计', value: toCurrency(latest.totalAssets) },
    { key: '账面盈利', value: toCurrency(metaDisplay.reduce((acc, cur) => acc + cur.profit, 0)) },
    {
      key: '预期计提分红',
      value: toCurrency(metaDisplay.reduce((acc, cur) => acc + cur.expectedDividend, 0)),
    },
  ];

  return (
    <>
      <Descriptions row data={stsCols} />
      <Divider />
      <Table columns={metaCols} dataSource={metaDisplay} pagination={false} />
      <br />
      <Table columns={recordsCols} dataSource={recordsDisplay} pagination={false} />
      <br />
      <ClearingAndSettlement />
    </>
  );
});
