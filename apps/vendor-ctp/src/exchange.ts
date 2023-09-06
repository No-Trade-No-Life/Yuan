import {
  IAccountInfo,
  IAccountMoney,
  IConnection,
  IOrder,
  IPosition,
  IProduct,
  OrderDirection,
  OrderStatus,
  OrderType,
  PositionVariant,
  Terminal,
} from '@yuants/protocol';
import '@yuants/protocol/lib/services/order';
import { ChildProcess, spawn } from 'child_process';
import { parse } from 'date-fns';
import { join } from 'path';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  defer,
  delayWhen,
  filter,
  first,
  forkJoin,
  from,
  map,
  mergeMap,
  of,
  raceWith,
  reduce,
  repeat,
  retry,
  share,
  shareReplay,
  takeWhile,
  tap,
  timeout,
  toArray,
  withLatestFrom,
} from 'rxjs';
import {
  ICThostFtdcDepthMarketDataField,
  ICThostFtdcInputOrderActionField,
  ICThostFtdcInputOrderField,
  ICThostFtdcInstrumentField,
  ICThostFtdcInvestorPositionField,
  ICThostFtdcOrderField,
  ICThostFtdcQryDepthMarketDataField,
  ICThostFtdcQryInstrumentField,
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
  TThostFtdcTimeConditionType,
  TThostFtdcVolumeConditionType,
} from './assets/ctp-types';
import { IBridgeMessage, createZMQConnection } from './bridge';

const ACCOUNT_ID = `${process.env.BROKER_ID!}/${process.env.USER_ID!}`;
const DATASOURCE_ID = ACCOUNT_ID;
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;

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

const requestIDGen = makeIdGen();
const orderRefGen = makeIdGen();

const mapToValue = <Req, Rep>(resp$: Observable<IBridgeMessage<Req, Rep>>) =>
  resp$.pipe(
    map((msg) => msg.res?.value),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

export const requestZMQ = <Req, Rep>(
  conn: IConnection<IBridgeMessage<Req, Rep>>,
  req: { method: string; params: Req },
) => {
  console.info(new Date(), req);
  const requestID = requestIDGen();
  const ret = conn.input$.pipe(
    //
    filter((msg) => msg.request_id === requestID && msg.res !== undefined),
    takeWhile((msg) => !msg.res!.is_last, true),
    // ISSUE: 碰到 -1 -2 问题先自杀
    tap((msg) => {
      if (msg.res!.error_code === -2 || msg.res!.error_code === -1) {
        process.exit(1);
      }
    }),
    map((msg) => {
      if (msg.res!.error_code === -2) {
        ctp_process$
          .pipe(
            //
            first((p) => !!p),
          )
          .subscribe((p) => {
            p!.kill();
            ctp_process$.next(null);
          });
        throw new Error('CTP RTN_CODE: -2');
      }
      return msg;
    }),
    timeout({ each: 5000, meta: `requestZMQ Timeout: ${req.method}` }),
    catchError((e) => {
      console.error(new Date(), e, 'REQ: ', req);
      throw e;
    }),
  );
  conn.output$.next({
    request_id: requestID,
    req: req,
  });
  return ret;
};

export const queryProducts = (conn: IConnection<IBridgeMessage<any, any>>): Observable<IProduct[]> =>
  requestZMQ<ICThostFtdcQryInstrumentField, ICThostFtdcInstrumentField>(conn, {
    method: 'ReqQryInstrument',
    params: {
      ExchangeID: '',
      reserve1: '',
      reserve2: '',
      reserve3: '',
      ExchangeInstID: '',
      ProductID: '',
      InstrumentID: '',
    },
  }).pipe(
    //
    mapToValue,
    map(
      (msg): IProduct => ({
        datasource_id: DATASOURCE_ID,
        product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
        name: msg.InstrumentName,
        base_currency: 'CNY',
        price_step: msg.PriceTick,
        volume_step: 1,
        value_speed: msg.VolumeMultiple,
      }),
    ),
    toArray(),
  );

export const queryAccountInfo = (
  conn: IConnection<IBridgeMessage<any, any>>,
  account_id: string,
  mapProductId2Product: Record<string, IProduct>,
) => {
  const positions$ = requestZMQ<ICThostFtdcQryInvestorPositionField, ICThostFtdcInvestorPositionField>(conn, {
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
    map((msg): IPosition => {
      const value_speed = mapProductId2Product[`${msg.ExchangeID}-${msg.InstrumentID}`].value_speed ?? 1;
      const position_price = msg.OpenCost / msg.Position / value_speed;
      return {
        position_id: `mixed`,
        product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
        variant: (
          {
            [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Long]: PositionVariant.LONG,
            [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Short]: PositionVariant.SHORT,
            // FIXME(cz): [TThostFtdcPosiDirectionType.THOST_FTDC_PD_Net]: ???
          } as Record<TThostFtdcPosiDirectionType, PositionVariant>
        )[msg.PosiDirection],
        volume: msg.Position,
        free_volume: msg.Position,
        closable_price: msg.SettlementPrice,
        floating_profit:
          (msg.SettlementPrice - position_price) *
          msg.Position *
          value_speed *
          (msg.PosiDirection === TThostFtdcPosiDirectionType.THOST_FTDC_PD_Long ? 1 : -1),
        position_price,
      };
    }),
    filter((v) => v.volume !== 0),
    toArray(),
  );

  const money$ = requestZMQ<ICThostFtdcQryTradingAccountField, ICThostFtdcTradingAccountField>(conn, {
    method: 'ReqQryTradingAccount',
    params: {
      BrokerID: '',
      InvestorID: '',
      CurrencyID: '',
      BizType: TThostFtdcBizTypeType.THOST_FTDC_BZTP_Future,
      AccountID: '',
    },
  }).pipe(
    //
    mapToValue,
    withLatestFrom(
      positions$.pipe(
        //
        mergeMap((positions) =>
          from(positions).pipe(
            //
            reduce((acc, cur) => acc + cur.floating_profit, 0),
          ),
        ),
      ),
    ),
    map(
      ([msg, profit]): IAccountMoney => ({
        currency: msg.CurrencyID,
        equity: msg.Balance,
        balance: msg.Balance - profit,
        profit: profit,
        free: msg.Available,
        used: msg.CurrMargin,
      }),
    ),
  );

  const orders$ = requestZMQ<ICThostFtdcQryOrderField, ICThostFtdcOrderField>(conn, {
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
        client_order_id: '',
        exchange_order_id: `${msg.ExchangeID}-${msg.OrderSysID}`,
        product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
        account_id: msg.UserID,
        type:
          msg.OrderPriceType === TThostFtdcOrderPriceTypeType.THOST_FTDC_OPT_LimitPrice
            ? OrderType.LIMIT
            : OrderType.MARKET,
        direction:
          TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open === (msg.CombOffsetFlag[0] as TThostFtdcOffsetFlagType)
            ? msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
              ? OrderDirection.OPEN_LONG
              : OrderDirection.OPEN_SHORT
            : msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
            ? OrderDirection.CLOSE_LONG
            : OrderDirection.CLOSE_SHORT,
        volume: msg.VolumeTotalOriginal,
        timestamp_in_us: parseCTPTime(msg.InsertDate, msg.InsertTime).getTime() * 1e3,
        price: msg.LimitPrice === 0 ? undefined : msg.LimitPrice,
        traded_volume: msg.VolumeTraded,
        // traded_price:
        status:
          msg.OrderStatus === TThostFtdcOrderStatusType.THOST_FTDC_OST_Canceled
            ? OrderStatus.CANCELLED
            : msg.OrderStatus === TThostFtdcOrderStatusType.THOST_FTDC_OST_AllTraded
            ? OrderStatus.TRADED
            : OrderStatus.ACCEPTED,
      }),
    ),
    filter((order) => order.status === OrderStatus.ACCEPTED),
    toArray(),
  );

  return forkJoin([money$, positions$, orders$]).pipe(
    //
    map(
      ([money, positions, orders]): IAccountInfo => ({
        account_id,
        money,
        positions,
        orders,
        timestamp_in_us: Date.now() * 1e3,
      }),
    ),
  );
};

export const queryHistoryOrders = (
  conn: IConnection<IBridgeMessage<any, any>>,
  brokerId: string,
  investorId: string,
) =>
  requestZMQ<ICThostFtdcQryTradeField, ICThostFtdcTradeField>(conn, {
    method: 'ReqQryTrade',
    params: {
      BrokerID: brokerId,
      InvestorID: investorId,
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
        client_order_id: '',
        exchange_order_id: `${msg.ExchangeID}-${msg.OrderSysID}`,
        product_id: `${msg.ExchangeID}-${msg.InstrumentID}`,
        account_id: msg.UserID,
        type: OrderType.LIMIT,
        direction:
          msg.Direction === TThostFtdcDirectionType.THOST_FTDC_D_Buy
            ? TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open === msg.OffsetFlag
              ? OrderDirection.OPEN_LONG
              : OrderDirection.CLOSE_LONG
            : TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open === msg.OffsetFlag
            ? OrderDirection.OPEN_SHORT
            : OrderDirection.CLOSE_SHORT,
        volume: msg.Volume,
        timestamp_in_us: parseCTPTime(msg.TradeDate, msg.TradeTime).getTime() * 1e3,
        price: msg.Price,
        traded_volume: msg.Volume,
        // traded_price:
        status: OrderStatus.TRADED,
      }),
    ),
    toArray(),
  );

export const submitOrder = (
  conn: IConnection<IBridgeMessage<any, any>>,
  brokerId: string,
  investorId: string,
  frontId: number,
  sessionId: number,
  order: IOrder,
) => {
  const [ctpExchangeId, instrumentId] = order.product_id.split('-');
  const orderRef = '' + orderRefGen();

  // 即使通过 OnRtnOrder 回来的回报也有可能包含来自交易所的报错，因此需要额外检查订单状态是否为取消
  const ret$ = conn.input$.pipe(
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

  const quote$ = requestZMQ<ICThostFtdcQryDepthMarketDataField, ICThostFtdcDepthMarketDataField>(conn, {
    method: 'ReqQryDepthMarketData',
    params: {
      reserve1: '',
      ExchangeID: ctpExchangeId,
      InstrumentID: instrumentId,
    },
  }).pipe(
    //
    mapToValue,
    first((v) => v.InstrumentID === instrumentId),
    share(),
  );

  // 这里如果有报错则会是 CTP 柜台的报错
  const error$ = quote$.pipe(
    //
    mergeMap((quote) =>
      requestZMQ<ICThostFtdcInputOrderField, ICThostFtdcOrderField | ICThostFtdcInputOrderField>(conn, {
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
            order.type === OrderType.STOP
              ? TThostFtdcContingentConditionType.THOST_FTDC_CC_BidPriceGreaterEqualStopPrice
              : TThostFtdcContingentConditionType.THOST_FTDC_CC_Immediately,
          // 时间条件
          TimeCondition:
            order.type === OrderType.IOC || order.type === OrderType.FOK
              ? TThostFtdcTimeConditionType.THOST_FTDC_TC_IOC
              : TThostFtdcTimeConditionType.THOST_FTDC_TC_GFD,
          // 成交量条件
          VolumeCondition:
            order.type === OrderType.FOK
              ? TThostFtdcVolumeConditionType.THOST_FTDC_VC_CV
              : TThostFtdcVolumeConditionType.THOST_FTDC_VC_AV,
          // 投机套保标识
          CombHedgeFlag: TThostFtdcHedgeFlagType.THOST_FTDC_HF_Speculation,
          // 开平标识
          CombOffsetFlag: [OrderDirection.OPEN_LONG, OrderDirection.OPEN_SHORT].includes(order.direction)
            ? TThostFtdcOffsetFlagType.THOST_FTDC_OF_Open
            : TThostFtdcOffsetFlagType.THOST_FTDC_OF_Close,
          // ISSUE: 买入包括开多平空; 卖出包括开空平多
          Direction: [OrderDirection.CLOSE_SHORT, OrderDirection.OPEN_LONG].includes(order.direction)
            ? TThostFtdcDirectionType.THOST_FTDC_D_Buy
            : TThostFtdcDirectionType.THOST_FTDC_D_Sell,
          LimitPrice:
            order.type === OrderType.MARKET
              ? // ISSUE: CTP 不支持市价单，但市价等效于挂在涨跌停价位
                [OrderDirection.CLOSE_SHORT, OrderDirection.OPEN_LONG].includes(order.direction)
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

export const cancelOrder = (
  conn: IConnection<IBridgeMessage<any, any>>,
  brokerId: string,
  investorId: string,
  frontId: number,
  sessionId: number,
  order: IOrder,
) => {
  if (!order.exchange_order_id) {
    return of(0).pipe(
      //
      map(() => ({
        res: { code: 400, message: 'Exchange OrderID Needed' },
      })),
    );
  }
  const ret$ = conn.input$.pipe(
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

  const [ctpExchangeId, ctpOrderSysId] = order.exchange_order_id.split('-');
  // 这里如果有报错则会是 CTP 柜台的报错
  const error$ = requestZMQ<ICThostFtdcInputOrderActionField, ICThostFtdcInputOrderActionField>(conn, {
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
    },
  });

  return ret$.pipe(
    raceWith(error$),
    map((msg) => ({
      res: { code: msg.res?.error_code ?? 0, message: msg.res?.error_message ?? 'OK' },
    })),
  );
};

process.env.ZMQ_PULL_URL = 'tcp://localhost:5700';
process.env.ZMQ_PUSH_URL = 'tcp://*:5701';

const account_id = ACCOUNT_ID;
const mutable = process.env.NO_TRADE! !== 'true';

const TERMINAL_ID = process.env.TERMINAL_ID || `CTP/${account_id}`;

const terminal = new Terminal(process.env.HV_URL!, {
  terminal_id: TERMINAL_ID,
  name: 'CTP',
  services: [{ account_id }, { datasource_id: DATASOURCE_ID }],
});

const zmqConn = createZMQConnection(process.env.ZMQ_PUSH_URL!, process.env.ZMQ_PULL_URL!);
// // ISSUE: 观测到 OnFrontDisconnected 之后会卡死，命令 exchange 自杀
// zmqConn.input$
//   .pipe(
//     //
//     filter((msg) => msg.res?.event === 'OnFrontDisconnected'),
//     tap(() => {
//       console.info(new Date(), 'OnFrontDisconnected', 'shutting down...');
//     })
//   )
//   .subscribe(() => {
//     process.exit(1);
//   });

const loginRes$ = zmqConn.input$.pipe(
  //
  first((msg) => msg?.res?.event !== undefined && msg.res.event === 'OnRspUserLogin'),
  map((msg) => msg.res!.value as ICThostFtdcRspUserLoginField),
  shareReplay(1),
);

const settlement$ = zmqConn.input$.pipe(
  //
  first((msg) => msg?.res?.event !== undefined && msg.res.event === 'OnRspSettlementInfoConfirm'),
  map((msg) => msg.res!.value as ICThostFtdcSettlementInfoConfirmField),
  shareReplay(1),
);

settlement$.subscribe();

const ctp_process$ = new BehaviorSubject<ChildProcess | null>(null);

ctp_process$.subscribe((p) => {
  if (p === null) {
    ctp_process$.next(spawn(join(__dirname, '../build/main_linux'), { detached: false, stdio: 'inherit' }));
  }
});

const products$ = defer(() => loginRes$.pipe(first())).pipe(
  mergeMap(() => queryProducts(zmqConn)),
  timeout({ each: 60000, meta: `QueryProduct Timeout` }),
  retry({ delay: 1000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

products$
  .pipe(delayWhen((products) => terminal.updateProducts(products, STORAGE_TERMINAL_ID)))
  .subscribe(() => {
    console.info(new Date(), '更新品种信息成功');
  });

const mapProductIdToProduct$ = products$.pipe(
  map((products) => Object.fromEntries(products.map((v) => [v.product_id, v]))),
  shareReplay(1),
);

const accountInfo$ = defer(() => mapProductIdToProduct$.pipe(first())).pipe(
  mergeMap((mapProductId2Product) => queryAccountInfo(zmqConn, account_id, mapProductId2Product)),
  retry({ delay: 1000 }),
  repeat({ delay: 1000 }),
  tap(() => {
    terminal.terminalInfo.status = 'OK';
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(accountInfo$);

terminal.setupService('QueryProducts', () =>
  products$.pipe(
    //
    map((data) => ({ res: { code: 0, message: 'OK', data: data } })),
  ),
);

terminal.setupService('QueryHistoryOrders', () =>
  combineLatest([loginRes$, settlement$]).pipe(
    first(),
    mergeMap(([loginRes, settlementRes]) =>
      queryHistoryOrders(zmqConn, loginRes.BrokerID, settlementRes.InvestorID).pipe(
        //
        delayWhen((data) => terminal.updateHistoryOrders(data, STORAGE_TERMINAL_ID)),
        map((data) => ({ res: { code: 0, message: 'OK', data: data } })),
      ),
    ),
  ),
);

terminal.setupService('SubmitOrder', (msg) => {
  if (!mutable) {
    return of({ res: { code: 403, message: 'ReadOnly Account!' } });
  }
  return combineLatest([loginRes$, settlement$]).pipe(
    first(),
    mergeMap(([loginRes, settlementRes]) =>
      submitOrder(
        zmqConn,
        loginRes.BrokerID,
        settlementRes.InvestorID,
        loginRes.FrontID,
        loginRes.SessionID,
        msg.req,
      ),
    ),
  );
});

terminal.setupService('CancelOrder', (msg) => {
  if (!mutable) {
    return of({ res: { code: 403, message: 'ReadOnly Account!' } });
  }
  return combineLatest([loginRes$, settlement$]).pipe(
    first(),
    mergeMap(([loginRes, settlementRes]) =>
      cancelOrder(
        zmqConn,
        loginRes.BrokerID,
        settlementRes.InvestorID,
        loginRes.FrontID,
        loginRes.SessionID,
        msg.req,
      ),
    ),
  );
});
