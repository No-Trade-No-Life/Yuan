import { Button, Card, Descriptions, Empty, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IAccountInfo, formatTime } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { format } from 'date-fns';
import { parse } from 'jsonc-parser';
import { useObservable, useObservableState } from 'observable-hooks';
import {
  EMPTY,
  Observable,
  combineLatest,
  combineLatestWith,
  concatMap,
  defer,
  filter,
  first,
  from,
  map,
  mergeMap,
  of,
  reduce,
  retry,
  scan,
  shareReplay,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { useAccountInfo } from '../AccountInfo';
import { fs } from '../FileSystem/api';
import { registerPage, usePageParams, usePageTitle } from '../Pages';
import { terminal$, useTick } from '../Terminals';

interface IFundComponentConfig {
  //
  title: string;

  account_id?: string;
  constant?: {
    equity: number;
    currency: string;
  };
}

interface IInvestor {
  investor_id: string;
  name: string;
  /** 份额 */
  share: number;
  /** 信用额 */
  credit?: number;
  /** 分红水位 */
  watermark: number;
  /** 净入金 */
  net_deposit: number;
  /** 业绩提成率 */
  commission_rate: number;
  email: string;
}

interface IFundConfig {
  account_id: string;
  currency: string;
  share: number;
  investors: IInvestor[];
  notify_terminal_id: string;
  exchange_rates: Array<{
    base_currency: string;
    quoted_currency: string;
    datasource_id: string;
    product_id: string;
  }>;
  components: IFundComponentConfig[];
}

interface IFundComponentInfo {
  title: string;
  value: number;
  currency: string;
}

interface IFundInfo {
  config: IFundConfig;
  accountInfo: IAccountInfo;
  fund_price: number;
  share: number;
  rates: Record<string, number>;
  components: IFundComponentInfo[];
}

const fromConfig = (config: IFundConfig): Observable<IFundInfo> => {
  const rates$ = from(config.exchange_rates).pipe(
    mergeMap((item) =>
      useTick(item.datasource_id, item.product_id).pipe(
        map((tick) => ({
          [`${item.base_currency}${item.quoted_currency}`]: tick.price!,
          [`${item.quoted_currency}${item.base_currency}`]: 1 / tick.price!,
        })),
      ),
    ),
    scan((acc, cur) => ({ ...acc, ...cur }), {} as Record<string, number>),
    shareReplay(1),
  );

  return from(config.components).pipe(
    map((component) => {
      if (component.account_id) {
        return useAccountInfo(component.account_id).pipe(
          //
          map((info) => ({
            title: component.title,
            value: info.money.equity,
            currency: info.money.currency,
          })),
        );
      }
      if (component.constant) {
        return of({
          title: component.title,
          value: component.constant.equity,
          currency: component.constant.currency,
        });
      }
      return EMPTY;
    }),
    toArray(),
    mergeMap((x) => combineLatest(x)),
    combineLatestWith(rates$),
    mergeMap(([components, rates]) =>
      from(components).pipe(
        reduce((acc, cur) => acc + cur.value * (rates[`${cur.currency}${config.currency}`] ?? 1), 0),
        map(
          (total): IFundInfo => ({
            config,
            accountInfo: {
              timestamp_in_us: Date.now() * 1e3,
              updated_at: Date.now(),
              account_id: config.account_id,
              money: {
                equity: total,
                currency: config.currency,
                balance: total,
                used: 0,
                free: total,
                profit: 0,
              },
              positions: [],
              orders: [],
            },
            fund_price: +(total / config.share).toFixed(6),
            rates,
            share: config.share,
            components,
          }),
        ),
      ),
    ),
  );
};

const getReport = (info: IFundInfo, investor_id: string): string => {
  const investor = info.config.investors.find((investor) => investor.investor_id === investor_id);
  if (!investor) {
    return `未找到投资者 ${investor_id}`;
  }

  const _信用额 = investor.credit || 0;
  const _账面资产 = investor.share * info.fund_price;
  const _超额业绩 = _账面资产 - investor.watermark;
  const _业绩提成 = _超额业绩 > 0 ? _超额业绩 * investor.commission_rate : 0;
  const _实际资产 = _账面资产 - _业绩提成 - _信用额;
  const _杠杆率 = _账面资产 / _实际资产;
  const _实际收益 = _实际资产 - investor.watermark;
  const _实际收益率 = _实际收益 / investor.watermark;
  const _业绩提成扣减份额 = _业绩提成 / info.fund_price;
  const _提成后份额 = investor.share - _业绩提成扣减份额;
  const _提成后业绩水位 = Math.max(investor.watermark, _实际资产);
  const _单位净值水位 = info.fund_price - _超额业绩 / investor.share;

  const _累计收益 = _实际资产 - investor.net_deposit;
  const _累计收益率 = _累计收益 / investor.net_deposit;

  const _基金规模 = info.fund_price * info.share;
  const _资产占比 = _账面资产 / _基金规模;

  const currency = info.accountInfo.money.currency;
  return [
    `基金 ${info.accountInfo.account_id} 净值报告`,
    '',
    `尊敬的 ${investor.name} 先生/女士`,
    '您好，',
    '',
    `简要来说，您的权益如下：`,
    `  您的实际权益为 ${_实际资产.toFixed(2)} ${currency}`,
    `  您的累计收益为 ${_累计收益.toFixed(2)} ${currency}`,
    `  您的累计收益率为 ${(_累计收益率 * 100).toFixed(2)}%`,
    ``,
    `如果您关心权益计算细节，我们为您列举如下：`,
    `  基金的单位净值是 ${info.fund_price.toFixed(6)} ${currency}`,
    `  您持有的份额是 ${investor.share.toFixed(2)} 份`,
    ``,
    `  您的业绩水位是 ${investor.watermark.toFixed(2)} ${currency}`,
    `  等效基金单位净值水位是 ${_单位净值水位.toFixed(6)} ${currency}`,
    ``,
    `  您的信用额是 ${_信用额.toFixed(2)} ${currency}`,
    `  您的净入金是 ${investor.net_deposit.toFixed(2)} ${currency}`,
    `  您的账面资产是 ${_账面资产.toFixed(2)} ${currency}`,
    `  您的杠杆率是 ${(_杠杆率 * 100).toFixed(2)}%`,
    `  我们为您达成的超额业绩是 ${_超额业绩.toFixed(2)} ${currency}`,
    ``,
    `  事先约定的业绩报酬率为超额业绩的 ${(investor.commission_rate * 100).toFixed(2)}%`,
    `  业绩报酬为 ${_业绩提成.toFixed(2)} ${currency}`,
    `  等同于扣减 ${_业绩提成扣减份额.toFixed(2)} 份 基金份额`,
    `  提成后您的新份额为 ${_提成后份额.toFixed(2)} 份`,
    `  提成后您的新业绩水位为 ${_提成后业绩水位.toFixed(2)} ${currency}`,
    ``,
    `如果您关心基金的总体状态，`,
    `  基金的总规模为 ${_基金规模.toFixed(2)} ${currency}`,
    `  您的资产占比为 ${(_资产占比 * 100).toFixed(2)}%`,

    '',
    `对于上述数据如有任何问题，欢迎您联系您的客户经理。`,
    '',
    '我们会全力维护您的权益，争取取得更好的业绩！',
    '',
    'NTNL 基金运维小组',
    `${format(info.accountInfo.updated_at!, 'yyyy年MM月dd日 HH:mm:ss')}`,
  ].join('\n');
};

registerPage('RealtimeAsset', () => {
  const params = usePageParams();
  const configFile = params.filename ?? '';

  const fundInfo$ = useObservable(
    (x$) =>
      x$.pipe(
        map((x) => x[0]),
        filter((v) => !!v),
        switchMap((configFile) =>
          defer(() => fs.readFile(configFile)).pipe(
            //
            retry({ delay: 1000 }),
          ),
        ),
        map((x) => parse(x) as IFundConfig),
        mergeMap((config) => fromConfig(config)),
      ),
    [configFile],
  );

  const fundInfo = useObservableState(fundInfo$);
  const fundName = fundInfo?.accountInfo.account_id;
  const title = `基金 ${fundName}`;
  usePageTitle(title);

  if (!fundInfo) {
    return (
      <Empty
        title="实时资产不可用"
        description={
          <Typography.Paragraph>
            <Typography.Text>
              有可能是文件系统未授权 <br />
              或 配置文件不存在 <br />
              或 配置文件不是合法的基金结算配置 <br />或 网络不给力
            </Typography.Text>
          </Typography.Paragraph>
        }
      ></Empty>
    );
  }

  return (
    <Space vertical align="start">
      {fundInfo && (
        <>
          <Typography.Title>{fundInfo.accountInfo.account_id}</Typography.Title>
          <Typography.Text>配置文件：{configFile}</Typography.Text>
          <Descriptions
            row={true}
            data={[
              {
                key: '总资产',
                value: (
                  <>
                    {fundInfo.accountInfo.money.equity.toFixed(2)} {fundInfo.accountInfo.money.currency}
                  </>
                ),
              },
              {
                key: '总份额',
                value: <>{fundInfo.share.toFixed(2)} 份</>,
              },
              {
                key: '单位净值',
                value: (
                  <>
                    {fundInfo.fund_price.toFixed(6)} {fundInfo.accountInfo.money.currency}
                  </>
                ),
              },
            ]}
          ></Descriptions>
          <Table
            dataSource={fundInfo.components}
            columns={[
              //
              { title: '成分', render: (_, x) => x.title },
              { title: '净值', render: (_, x) => `${x.value.toFixed(2)} ${x.currency}` },
              {
                title: '汇率',
                render: (_, x) =>
                  `${fundInfo.rates[`${x.currency}${fundInfo.accountInfo.money.currency}`] ?? 1}`,
              },
              {
                title: `折合 ${fundInfo.accountInfo.money.currency}`,
                render: (_, x) =>
                  `${(
                    x.value * (fundInfo.rates[`${x.currency}${fundInfo.accountInfo.money.currency}`] ?? 1)
                  ).toFixed(2)} ${fundInfo.accountInfo.money.currency}`,
              },
            ]}
            pagination={false}
          />

          <Button
            onClick={() => {
              terminal$
                .pipe(
                  filter((x): x is Exclude<typeof x, null> => !!x),
                  first(),
                  mergeMap((terminal) =>
                    from(fundInfo.config.investors).pipe(
                      concatMap((investor) => sendReportToInvestor(terminal, fundInfo, investor)),
                    ),
                  ),
                )
                .subscribe();
            }}
          >
            全部发送
          </Button>
          {fundInfo.config.investors.map((investor) => (
            <Card
              actions={[
                <Button
                  onClick={() => {
                    terminal$
                      .pipe(
                        filter((x): x is Exclude<typeof x, null> => !!x),
                        first(),
                        mergeMap((terminal) => sendReportToInvestor(terminal, fundInfo, investor)),
                      )
                      .subscribe();
                  }}
                >
                  单独发送
                </Button>,
              ]}
            >
              <Typography.Paragraph>
                <pre>{getReport(fundInfo, investor.investor_id)}</pre>
              </Typography.Paragraph>
            </Card>
          ))}
        </>
      )}
    </Space>
  );
});

function sendReportToInvestor(terminal: Terminal, fundInfo: IFundInfo, investor: IInvestor) {
  return terminal
    .request('Notify', fundInfo.config.notify_terminal_id, {
      receiver_id: investor.email,
      message: getReport(fundInfo, investor.investor_id),
    })
    .pipe(
      tap((msg) => {
        if (msg.res?.code === 0) {
          Toast.success(`成功发送报告至 ${investor.name} ${investor.email}`);
          console.info(formatTime(Date.now()), `成功发送报告至 ${investor.name} ${investor.email}`);
        } else {
          Toast.error(`发送报告失败 ${investor.name} ${investor.email}`);
          console.info(formatTime(Date.now()), `发送报告失败 ${investor.name} ${investor.email}`);
        }
      }),
    );
}
