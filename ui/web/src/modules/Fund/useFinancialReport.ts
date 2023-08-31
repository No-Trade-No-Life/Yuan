import { useEffect, useState } from 'react';
import { fs } from '../FileSystem/api';

// 当前投资人投资情况
type InvestStatus = {
  time: string; // 日期
  description: string; // 描述
  totalAssets: number; // 总资产
  totalShare: number; // 总份额
  unitPrice: number; // 份额净值
  investors: Record<string, InvestorDetails>; // 投资人数据
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
export type InvestorDetails = InvestorMeta & {
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
  name: '',
  share: 0,
  dividendBase: 0,
  deposit: 0,
  dividendRate: 0,
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

export const useFinancialReport = () => {
  const FILENAME = '/aof.log';
  const [history, setHistory] = useState<InvestStatus[]>([]);

  const cid: InvestStatus = {
    time: '',
    description: '',
    totalAssets: 0, // 总资产
    totalShare: 0, // 总份额
    unitPrice: 0, // 份额净值
    investors: {},
  };

  const constructHistory = (records: string[]) => {
    const h: InvestStatus[] = [];
    records.map((r) => {
      if (!r) return; // 换行符后的空行
      const [time, description, ...rest] = r.split(' ');
      cid.time = time;
      cid.description = description;
      rest.map((ele) => {
        // 总资产更新
        if (Number(ele)) {
          cid.totalAssets = Number(ele);
          return;
        }
        // 投资人更新
        const i = ele.split('-');
        const old = cid.investors[i[0]]; // old may be undefined
        // 仅更新投资人计提百分比
        if (i.length === 2) {
          const investor = {
            ...initInvestor,
            ...old,
            name: i[0],
            dividendRate: Number(i[1]),
          };
          cid.investors[i[0]] = investor;
          return;
        }
        // 更新投资人所有数据
        const investor = {
          ...initInvestor,
          ...old,
          name: i[0],
          share: Number(i[1]),
          dividendBase: Number(i[2]),
          deposit: Number(i[3]),
        };
        if (Number(i[4])) investor.dividendRate = Number(i[4]);
        cid.investors[i[0]] = investor;
      });
      h.push(genInvestStatus());
    });
    setHistory(h);
  };

  const genInvestStatus = (): InvestStatus => {
    const totalShare = Object.values(cid.investors).reduce((acc, cur) => acc + cur.share, 0); // 总份额
    const unitPrice = cid.totalAssets / totalShare; // 份额净值
    cid.totalShare = totalShare;
    cid.unitPrice = unitPrice;
    Object.values(cid.investors).forEach((v) => {
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
      cid.investors[v.name] = {
        name: v.name,
        dividendRate,
        share,
        dividendBase,
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
        deposit,
        accumulatedProfit,
        accumulatedProfitRate,
      };
    });
    return structuredClone(cid);
  };

  useEffect(() => {
    const parseFile = async () => {
      const contents = await fs.readFile(FILENAME);
      const records = contents.split('\n');
      constructHistory(records);
    };
    parseFile();
  }, []);

  const addRecord = async (record: string) => {
    await appendRecord2File(record);
  };

  const handleDividend = async (time: string) => {
    const latest = history[history.length - 1];
    if (!latest) throw Error('解析错误');
    let totalAssets = 0;
    let totalDividend = 0;
    let totalDividendShare = 0;
    const investors = Object.values(latest.investors)
      .map((investor) => {
        if (investor.profit <= 0) throw Error('未盈利，无法分红');
        totalAssets += investor.expectedPostDividendAssets;
        totalDividend += investor.expectedDividend;
        totalDividendShare += investor.expectedDividendShare;
        const { name, expectedPostDividendShare, expectedPostDividendAssets, deposit, dividendRate } =
          investor;
        return `${name}-${expectedPostDividendShare}-${expectedPostDividendAssets}-${deposit}-${dividendRate}`;
      })
      .join(' ');

    const description = `分红，计提份额${totalDividendShare.toFixed(2)}，分红金额${totalDividend.toFixed(2)}`;
    const record = `${time} ${description} ${investors} ${totalAssets}\n`;
    await appendRecord2File(record);
  };

  const appendRecord2File = async (record: string) => {
    let contents = await fs.readFile(FILENAME);
    if (contents.endsWith('\n')) {
      contents += record;
    } else {
      contents += `\n${record}`;
    }
    await fs.writeFile(FILENAME, contents);
  };

  return {
    history,
    addRecord,
    handleDividend,
  };
};
