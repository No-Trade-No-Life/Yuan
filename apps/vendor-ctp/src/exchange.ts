import { IPosition, addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { parse } from 'date-fns';
import {
  Observable,
  filter,
  first,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  mergeMap,
  of,
  raceWith,
  share,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import {
  ICThostFtdcDepthMarketDataField,
  ICThostFtdcInputOrderActionField,
  ICThostFtdcInputOrderField,
  ICThostFtdcInvestorPositionField,
  ICThostFtdcOrderField,
  ICThostFtdcQryDepthMarketDataField,
  ICThostFtdcQryInvestorPositionField,
  ICThostFtdcQryOrderField,
  ICThostFtdcQryTradeField,
  ICThostFtdcQryTradingAccountField,
  ICThostFtdcRspUserLoginField,
  ICThostFtdcSettlementInfoConfirmField,
  ICThostFtdcTradeField,
  ICThostFtdcTradingAccountField,
  TThostFtdcActionFlagType,
  TThostFtdcBizTypeType,
  TThostFtdcContingentConditionType,
  TThostFtdcDirectionType,
  TThostFtdcForceCloseReasonType,
  TThostFtdcHedgeFlagType,
  TThostFtdcOffsetFlagType,
  TThostFtdcOrderPriceTypeType,
  TThostFtdcOrderStatusType,
  TThostFtdcPosiDirectionType,
  TThostFtdcProductClassType,
  TThostFtdcTimeConditionType,
  TThostFtdcVolumeConditionType,
} from './assets/ctp-types';
import { ACCOUNT_ID, BROKER_ID, DATASOURCE_ID, INVESTOR_ID, requestZMQ, terminal } from './context';
import { IBridgeMessage } from './interfaces';
import { cacheOfProduct } from './product';
import { ensureMarketDataSubscription, quoteToWrite$ } from './quote';

const input$ = terminal.channel.subscribeChannel<IBridgeMessage<any, any>>('CTP/ZMQ', ACCOUNT_ID);

const parseCTPTime = (date: string, time: string): Date =>
  parse(`${date}-${time}`, 'yyyyMMdd-HH:mm:ss', new Date());

const makeIdGen = () => {
  let requestID = 0;
  return () => {
    if (requestID >= 2147483647) {
      requestID = 0;
    }
    requestID++;
    return requestID;
  };
};

const orderRefGen = makeIdGen();

const mapToValue = <Req, Rep>(resp$: Observable<IBridgeMessage<Req, Rep>>) =>
  resp$.pipe(
    map((msg) => msg.res?.value),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const submitOrder = (
  brokerId: string,
  investorId: string,
  frontId: number,
  sessionId: number,
  order: IOrder,
) => {
  const [ctpExchangeId, instrumentId] = order.product_id.split('-');
  const orderRef = '' + orderRefGen();

  // 即使通过 OnRtnOrder 回来的回报也有可能包含来自交易所的报错，因此需要额外检查订单状态是否为取消
  const ret$ = from(input$).pipe(
    //
    first(
      (msg) =>
        msg.res?.value !== undefined &&
        msg.res.event === 'OnRtnOrder' &&
        (msg.res.value as ICThostFtdcOrderField).FrontID === frontId &&
        (msg.res.value as ICThostFtdcOrderField).SessionID === sessionId &&
        (msg.res.value as ICThostFtdcOrderField).OrderRef === orderRef,
    ),
  );

  const quote$ =
    order.order_type === 'MARKET'
      ? requestZMQ<ICThostFtdcQryDepthMarketDataField, ICThostFtdcDepthMarketDataField>({
          method: 'ReqQryDepthMarketData',
          params: {
            reserve1: '',
            ExchangeID: ctpExchangeId,
            InstrumentID: instrumentId,
            ProductClass: TThostFtdcProductClassType.THOST_FTDC_PC_Futures,
          },
        }).pipe(
          //
          mapToValue,
          first((v) => v.InstrumentID === instrumentId),
          tap((quote) => {
            console.info(formatTime(Date.now()), 'CTP_Quote', JSON.stringify(quote));
            quoteToWrite$.next({
              datasource_id: DATASOURCE_ID,
              product_id: order.product_id,
              ask_price: `${quote.AskPrice1}`,
              bid_price: `${quote.BidPrice1}`,
              last_price: `${quote.LastPrice}`,
              ask_volume: `${quote.AskVolume1}`,
              bid_volume: `${quote.BidVolume1}`,
            });
          }),
          share(),
        )
      : of({
          UpperLimitPrice: 0,
          LowerLimitPrice: 0,
        });

  // 这里如果有报错则会是 CTP 柜台的报错
  const error$ = quote$.pipe(
    //
    mergeMap((quote) =>
      requestZMQ<ICThostFtdcInputOrderField, ICThostFtdcOrderField | ICThostFtdcInputOrderField>({
        method: 'ReqOrderInsert',
        params: {
          BrokerID: brokerId,
          InvestorID: investorId,
          ExchangeID: ctpExchangeId,
          InstrumentID: instrumentId,
          // 市价单/现价单 上期所不支持市价单
          OrderPriceType: TThostFtdcOrderPriceTypeType.THOST_FTDC_OPT_LimitPrice,
          // 触发条件
          ContingentCondition:
            order.order_type === 'STOP'
              ? TThostFtdcContingentConditionType.THOST_FTDC_CC_BidPriceGreaterEqualStopPrice
              : TThostFtdcContingentConditionType.THOST_FTDC_CC_Immediately,
          // 时间条件
          TimeCondition:
            order.order_type === 'IOC' || order.order_type === 'FOK'
              ? TThostFtdcTimeConditionType.THOST_FTDC_TC_IOC
              : TThostFtdcTimeConditionType.THOST_FTDC_TC_GFD,
          // 成交量条件
          VolumeCondition:
            order.order_type === 'FOK'
              ? TThostFtdcVolumeConditionType.THOST_FTDC_VC_CV
              : TThostFtdcVolumeConditionType.THOST_FTDC_VC_AV,
          // 投机套保标识
          CombHedgeFlag: TThostFtdcHedgeFlagType.THOST_FTDC_HF_Speculation,
          // 开平标识
          CombOffsetFlag:
            order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT'
              ? TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open
              : TThostFtdcOffsetFlagType.THOST_FTDC_OF_Close,
          // ISSUE: 买入包括开多平空; 卖出包括开空平多
          Direction:
            order.order_direction === 'CLOSE_SHORT' || order.order_direction === 'OPEN_LONG'
              ? TThostFtdcDirectionType.THOST_FTDC_D_Buy
              : TThostFtdcDirectionType.THOST_FTDC_D_Sell,
          LimitPrice:
            order.order_type === 'MARKET'
              ? // ISSUE: CTP 不支持市价单，但市价等效于挂在涨跌停价位
                order.order_direction === 'CLOSE_SHORT' || order.order_direction === 'OPEN_LONG'
                ? quote.UpperLimitPrice
                : quote.LowerLimitPrice
              : order.price ?? 0 /* 如果执意下限价单却没给价格 */,
          VolumeTotalOriginal: order.volume,
          ForceCloseReason: TThostFtdcForceCloseReasonType.THOST_FTDC_FCC_NotForceClose,
          reserve1: '',
          reserve2: '',
          OrderRef: orderRef,
          UserID: '',
          GTDDate: '',
          MinVolume: 0,
          StopPrice: order.stop_loss_price ?? 0,
          IsAutoSuspend: 0,
          BusinessUnit: '',
          RequestID: 0,
          UserForceClose: 0,
          IsSwapOrder: 0,
          InvestUnitID: '',
          AccountID: '',
          CurrencyID: '',
          ClientID: '',
          MacAddress: '',
          IPAddress: '',
          OrderMemo: '',
          SessionReqSeq: 0,
        },
      }),
    ),
  );

  return ret$.pipe(
    //
    raceWith(error$),
    timeout({ each: 5000, meta: `requestZMQ Timeout: SubmitOrder` }),
    map((msg) => ({
      res: { code: msg.res?.error_code ?? 0, message: msg.res?.error_message ?? 'OK' },
    })),
  );
};

const cancelOrder = (
  brokerId: string,
  investorId: string,
  frontId: number,
  sessionId: number,
  order: IOrder,
) => {
  if (!order.order_id) {
    return of(0).pipe(
      //
      map(() => ({
        res: { code: 400, message: 'OrderID Needed' },
      })),
    );
  }
  const ret$ = from(input$).pipe(
    //
    first(
      (msg) =>
        msg.res?.value !== undefined &&
        msg.res.event === 'OnRtnOrder' &&
        (msg.res.value as ICThostFtdcOrderField).ExchangeID === ctpExchangeId &&
        (msg.res.value as ICThostFtdcOrderField).OrderSysID === ctpOrderSysId,
    ),
    // 即使通过 OnRtnOrder 回来的回报也有可能包含来自交易所的报错，因此需要额外检查订单状态是否为取消
    map((msg) => {
      if (
        (msg.res!.value as ICThostFtdcOrderField).OrderStatus ===
        TThostFtdcOrderStatusType.THOST_FTDC_OST_Canceled
      ) {
        msg.res!.error_code = 1;
        msg.res!.error_message = (msg.res!.value as ICThostFtdcOrderField).StatusMsg;
      }
      return msg;
    }),
  );

  const [ctpExchangeId, ctpOrderSysId] = order.order_id.split('-');
  // 这里如果有报错则会是 CTP 柜台的报错
  const error$ = requestZMQ<ICThostFtdcInputOrderActionField, ICThostFtdcInputOrderActionField>({
    method: 'ReqOrderAction',
    params: {
      BrokerID: brokerId,
      InvestorID: investorId,
      OrderActionRef: 0,
      OrderRef: '',
      RequestID: 0,
      FrontID: frontId,
      SessionID: sessionId,
      ExchangeID: ctpExchangeId,
      OrderSysID: ctpOrderSysId,
      ActionFlag: TThostFtdcActionFlagType.THOST_FTDC_AF_Delete,
      LimitPrice: 0,
      VolumeChange: 0,
      UserID: '',
      reserve1: '',
      InvestUnitID: '',
      reserve2: '',
      MacAddress: '',
      InstrumentID: '',
      IPAddress: '',
      OrderMemo: '',
      SessionReqSeq: 0,
    },
  });

  return ret$.pipe(
    raceWith(error$),
    map((msg) => ({
      res: { code: msg.res?.error_code ?? 0, message: msg.res?.error_message ?? 'OK' },
    })),
  );
};

const account_id = ACCOUNT_ID;

const subscribedInstrumentIds = new Set<string>();

// // ISSUE: 观测到 OnFrontDisconnected 之后会卡死，命令 exchange 自杀
// zmqConn.input$
//   .pipe(
//     //
//     filter((msg) => msg.res?.event === 'OnFrontDisconnected'),
//     tap(() => {
//       console.info(formatTime(Date.now()), 'OnFrontDisconnected', 'shutting down...');
//     })
//   )
//   .subscribe(() => {
//     process.exit(1);
//   });

provideAccountInfoService(
  terminal,
  account_id,
  async () => {
    const [positionsRes, money1] = await Promise.all([
      firstValueFrom(
        requestZMQ<ICThostFtdcQryInvestorPositionField, ICThostFtdcInvestorPositionField>({
          method: 'ReqQryInvestorPosition',
          params: {
            BrokerID: '',
            InvestorID: '',
            reserve1: '',
            InvestUnitID: '',
            ExchangeID: '',
            InstrumentID: '',
          },
        }).pipe(
          //
          mapToValue,
          toArray(),
        ),
      ),
      firstValueFrom(
        requestZMQ<ICThostFtdcQryTradingAccountField, ICThostFtdcTradingAccountField>({
          method: 'ReqQryTradingAccount',
          params: {
            BrokerID: '',
            InvestorID: '',
            CurrencyID: '',
            BizType: TThostFtdcBizTypeType.THOST_FTDC_BZTP_Future,
            AccountID: '',
          },
        }).pipe(mapToValue),
      ),
    ]);

    const positions: IPosition[] = [];
    for (const msg of positionsRes) {
      // Lazy Load Product: 避免一次性查询所有合约信息 (可能有上万个合约)
      const theProduct = await cacheOfProduct.query(`${msg.ExchangeID}-${msg.InstrumentID}`);
      const value_scale = theProduct?.value_scale ?? 1;
      const position_price = msg.OpenCost / msg.Position / value_scale;

      const product_id = `${msg.ExchangeID}-${msg.InstrumentID}`;

      //
      ensureMarketDataSubscription(product_id);

      positions.push({
        position_id: `mixed`,
        datasource_id: DATASOURCE_ID,
        product_id: product_id,
        direction: (
          {
            [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Long]: 'LONG',
            [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Short]: 'SHORT',
            // FIXME(cz): [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Net]: ???
          } as Record<TThostFtdcPosiDirectionType, string>
        )[msg.PosiDirection],
        volume: msg.Position,
        free_volume: msg.Position,
        closable_price: msg.SettlementPrice,
        floating_profit:
          (msg.SettlementPrice - position_price) *
          msg.Position *
          value_scale *
          (msg.PosiDirection === TThostFtdcPosiDirectionType.THOST_FTDC_PD_Long ? 1 : -1),
        position_price,
        valuation: 0, // TODO: 估值
      });
    }

    return {
      money: {
        currency: money1.CurrencyID,
        equity: money1.Balance,
        free: money1.Available,
      },
      positions,
    };
  },
  {
    auto_refresh_interval: 5000,
  },
);

terminal.server.provideService(
  'QueryPendingOrders',
  { required: ['account_id'], properties: { account_id: { const: ACCOUNT_ID } } },
  async () => {
    const orders = await firstValueFrom(
      requestZMQ<ICThostFtdcQryOrderField, ICThostFtdcOrderField>({
        method: 'ReqQryOrder',
        params: {
          BrokerID: '',
          InvestorID: '',
          reserve1: '',
          ExchangeID: '',
          OrderSysID: '',
          InsertTimeStart: '',
          InsertTimeEnd: '',
          InvestUnitID: '',
          InstrumentID: '',
        },
      }).pipe(
        //
        mapToValue,
        map(
          (msg): IOrder => ({
            order_id: `${msg.ExchangeID}-${msg.OrderSysID}`,
            product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
            account_id: ACCOUNT_ID,
            order_type:
              msg.OrderPriceType === TThostFtdcOrderPriceTypeType.THOST_FTDC_OPT_LimitPrice
                ? 'LIMIT'
                : 'MARKET',
            order_direction:
              TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open ===
              (msg.CombOffsetFlag[0] as TThostFtdcOffsetFlagType)
                ? msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
                  ? 'OPEN_LONG'
                  : 'OPEN_SHORT'
                : msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
                ? 'CLOSE_SHORT'
                : 'CLOSE_LONG',
            volume: msg.VolumeTotalOriginal,
            submit_at: parseCTPTime(msg.InsertDate, msg.InsertTime).getTime() * 1e3,
            price: msg.LimitPrice === 0 ? undefined : msg.LimitPrice,
            traded_volume: msg.VolumeTraded,
            // traded_price:
            order_status:
              msg.OrderStatus === TThostFtdcOrderStatusType.THOST_FTDC_OST_Canceled
                ? 'CANCELLED'
                : msg.OrderStatus === TThostFtdcOrderStatusType.THOST_FTDC_OST_AllTraded
                ? 'TRADED'
                : 'ACCEPTED',
          }),
        ),
        filter((order) => order.order_status === 'ACCEPTED'),
        toArray(),
      ),
    );

    return { res: { code: 0, message: 'OK', data: orders } };
  },
);

addAccountMarket(terminal, { account_id, market_id: 'CTP' });

terminal.server.provideService(
  'QueryHistoryOrders',
  {
    required: ['account_id'],
    properties: {
      account_id: { const: ACCOUNT_ID },
    },
  },
  async () => {
    const orders = await firstValueFrom(
      requestZMQ<ICThostFtdcQryTradeField, ICThostFtdcTradeField>({
        method: 'ReqQryTrade',
        params: {
          BrokerID: BROKER_ID,
          InvestorID: INVESTOR_ID,
          reserve1: '',
          ExchangeID: '',
          TradeID: '',
          TradeTimeStart: '',
          TradeTimeEnd: '',
          InvestUnitID: '',
          InstrumentID: '',
        },
      }).pipe(
        //
        mapToValue,
        map(
          (msg): IOrder => ({
            order_id: `${msg.ExchangeID}-${msg.OrderSysID}`,
            product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
            account_id: ACCOUNT_ID,
            order_type: 'LIMIT',
            order_direction:
              msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
                ? TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open === msg.OffsetFlag
                  ? 'OPEN_LONG'
                  : 'CLOSE_LONG'
                : TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open === msg.OffsetFlag
                ? 'OPEN_SHORT'
                : 'CLOSE_SHORT',
            volume: msg.Volume,
            submit_at: parseCTPTime(msg.TradeDate, msg.TradeTime).getTime() * 1e3,
            price: msg.Price,
            traded_volume: msg.Volume,
            // traded_price:
            order_status: 'TRADED',
          }),
        ),
        toArray(),
      ),
    );
    return { res: { code: 0, message: 'OK', data: orders } };
  },
);

terminal.server.provideService<IOrder>(
  'SubmitOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: { const: ACCOUNT_ID },
    },
  },
  async (msg) => {
    const [loginRes, settlementRes] = await Promise.all([
      terminal.client.requestForResponseData<{ account_id: string }, ICThostFtdcRspUserLoginField>(
        'CTP/QueryLoginResponse',
        {
          account_id: ACCOUNT_ID,
        },
      ),
      terminal.client.requestForResponseData<{ account_id: string }, ICThostFtdcSettlementInfoConfirmField>(
        'CTP/QuerySettlementResponse',
        {
          account_id: ACCOUNT_ID,
        },
      ),
    ]);

    await lastValueFrom(
      submitOrder(loginRes.BrokerID, settlementRes.InvestorID, loginRes.FrontID, loginRes.SessionID, msg.req),
    );

    return { res: { code: 0, message: 'OK' } };
  },
);

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: { const: ACCOUNT_ID },
    },
  },
  async (msg) => {
    const [loginRes, settlementRes] = await Promise.all([
      terminal.client.requestForResponseData<{ account_id: string }, ICThostFtdcRspUserLoginField>(
        'CTP/QueryLoginResponse',
        {
          account_id: ACCOUNT_ID,
        },
      ),
      terminal.client.requestForResponseData<{ account_id: string }, ICThostFtdcSettlementInfoConfirmField>(
        'CTP/QuerySettlementResponse',
        {
          account_id: ACCOUNT_ID,
        },
      ),
    ]);

    await lastValueFrom(
      cancelOrder(loginRes.BrokerID, settlementRes.InvestorID, loginRes.FrontID, loginRes.SessionID, msg.req),
    );

    return { res: { code: 0, message: 'OK' } };
  },
);
