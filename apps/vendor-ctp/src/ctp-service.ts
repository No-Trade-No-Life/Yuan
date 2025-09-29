import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import {
  BehaviorSubject,
  catchError,
  filter,
  first,
  from,
  map,
  Observable,
  takeWhile,
  tap,
  timeout,
} from 'rxjs';
import { ICThostFtdcRspUserLoginField, ICThostFtdcSettlementInfoConfirmField } from './assets/ctp-types';
import { createZMQConnection } from './bridge';
import './ctp-monitor';
import { restartCtpAction$ } from './ctp-monitor';
import { IBridgeMessage } from './interfaces';

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

// Note: You should never create multiple CTP in the same machine
export const zmqConn = createZMQConnection(
  process.env.ZMQ_PUSH_URL || 'tcp://*:5701',
  process.env.ZMQ_PULL_URL || 'tcp://*:5700',
);

const _requestZMQ = <Req, Res>(req: {
  method: string;
  params: Req;
}): Observable<IBridgeMessage<Req, Res>> => {
  const requestID = requestIDGen();
  console.info(
    formatTime(Date.now()),
    'CTP Request',
    `requestID=${requestID} method=${req.method} params=${JSON.stringify(req.params)}`,
  );
  const ret = from(zmqConn.input$).pipe(
    //
    filter((msg) => msg.request_id === requestID && msg.res !== undefined),
    takeWhile((msg) => !msg.res!.is_last, true),
    // 0: 成功
    // -1: 因网络连接发送失败
    // -2: 未处理请求队列总数量超限
    // -3: 每秒发送请求数量超限
    map((msg) => {
      // 遇到网络问题，自动重启 CTP
      if (msg.res?.error_code === -1) {
        console.warn(formatTime(Date.now()), 'CTP Connection Error, restarting CTP Bridge...');
        restartCtpAction$.next();
      }
      if (msg.res!.error_code < 0) {
        throw new Error(`CTP RTN_CODE: ${msg.res!.error_code}`);
      }
      return msg;
    }),
    timeout({ each: 5000, meta: `requestZMQ Timeout: requestID=${requestID} method=${req.method}` }),
    catchError((e) => {
      console.error(formatTime(Date.now()), e, 'REQ: ', req);
      throw e;
    }),
  );
  zmqConn.output$.next({
    request_id: requestID,
    req: req,
  });
  return ret;
};

const ACCOUNT_ID = `${process.env.BROKER_ID!}/${process.env.USER_ID!}`;
const terminal = Terminal.fromNodeEnv();

const QueryInProcessingLimit = +process.env.QUERY_IN_PROCESSING_LIMIT! || 1;
const QueryRPS = +process.env.QUERY_RPS_LIMIT! || 1;

terminal.server.provideService<
  { account_id: string; method: string; params: any },
  void,
  IBridgeMessage<any, any>
>(
  'CTP/Query',
  {
    required: ['account_id', 'method', 'params'],
    properties: {
      account_id: { type: 'string', const: ACCOUNT_ID },
      method: { type: 'string', pattern: '^ReqQry' },
      params: { type: 'object', additionalItems: true },
    },
  },
  (msg) => {
    if (!loginRes$.value) {
      throw new Error('CTP not logged in');
    }

    if (!settlementRes$.value) {
      throw new Error('CTP settlement not confirmed');
    }

    return _requestZMQ({
      method: msg.req.method,
      params: msg.req.params,
    }).pipe(map((x) => ({ frame: x })));
  },
  {
    concurrent: QueryInProcessingLimit,
    egress_token_capacity: QueryRPS,
    max_pending_requests: 60 * QueryRPS,
  },
);

const OrderInProcessingLimit = +process.env.ORDER_IN_PROCESSING_LIMIT! || 1;
const OrderRPS = +process.env.ORDER_RPS_LIMIT! || 100;
terminal.server.provideService<
  { account_id: string; method: string; params: any },
  void,
  IBridgeMessage<any, any>
>(
  'CTP/Query',
  {
    required: ['account_id', 'method', 'params'],
    properties: {
      account_id: { type: 'string', const: ACCOUNT_ID },
      method: { type: 'string', pattern: '^ReqOrder' },
      params: { type: 'object', additionalItems: true },
    },
  },
  (msg) => {
    if (!loginRes$.value) {
      throw new Error('CTP not logged in');
    }

    if (!settlementRes$.value) {
      throw new Error('CTP settlement not confirmed');
    }

    return _requestZMQ({
      method: msg.req.method,
      params: msg.req.params,
    }).pipe(map((x) => ({ frame: x })));
  },
  {
    concurrent: QueryInProcessingLimit,
    egress_token_capacity: OrderRPS,
    max_pending_requests: 60 * OrderRPS,
  },
);

const MdInProcessingLimit = +process.env.MD_IN_PROCESSING_LIMIT! || QueryInProcessingLimit;
const MdRPS = +process.env.MD_RPS_LIMIT! || QueryRPS;

terminal.server.provideService<
  { account_id: string; method: string; params: any },
  void,
  IBridgeMessage<any, any>
>(
  'CTP/Md',
  {
    required: ['account_id', 'method', 'params'],
    properties: {
      account_id: { type: 'string', const: ACCOUNT_ID },
      method: { type: 'string', pattern: '^(ReqUser|Subscribe|UnSubscribe)' },
      params: { type: 'object', additionalProperties: true },
    },
  },
  (msg) => {
    if (!loginRes$.value) {
      throw new Error('CTP not logged in');
    }

    return _requestZMQ({
      method: msg.req.method,
      params: msg.req.params,
    }).pipe(map((x) => ({ frame: x })));
  },
  {
    concurrent: MdInProcessingLimit,
    egress_token_capacity: MdRPS,
    max_pending_requests: 60 * MdRPS,
  },
);

const loginRes$ = new BehaviorSubject<ICThostFtdcRspUserLoginField | null>(null);

from(zmqConn.input$)
  .pipe(
    //
    first((msg) => msg?.res?.event !== undefined && msg.res.event === 'OnRspUserLogin'),
    map((msg) => msg.res!.value as ICThostFtdcRspUserLoginField),
    tap((res) => {
      console.info(formatTime(Date.now()), 'CTP Logged In');
      loginRes$.next(res);
    }),
  )
  .subscribe();

const settlementRes$ = new BehaviorSubject<ICThostFtdcSettlementInfoConfirmField | null>(null);

from(zmqConn.input$)
  .pipe(
    //
    first((msg) => msg?.res?.event !== undefined && msg.res.event === 'OnRspSettlementInfoConfirm'),
    map((msg) => msg.res!.value as ICThostFtdcSettlementInfoConfirmField),
    tap((res) => {
      console.info(formatTime(Date.now()), 'CTP Settlement Confirmed');
      settlementRes$.next(res);
    }),
  )
  .subscribe();

terminal.server.provideService(
  'CTP/QueryLoginResponse',
  { required: ['account_id'], properties: { account_id: { const: ACCOUNT_ID } } },
  async () => {
    if (!loginRes$.value) {
      throw new Error('CTP not logged in');
    }
    return { res: { code: 0, message: 'OK', data: loginRes$.value } };
  },
);

terminal.server.provideService(
  'CTP/QuerySettlementResponse',
  { required: ['account_id'], properties: { account_id: { const: ACCOUNT_ID } } },
  async () => {
    if (!settlementRes$.value) {
      throw new Error('CTP settlement not confirmed');
    }
    return { res: { code: 0, message: 'OK', data: settlementRes$.value } };
  },
);

terminal.channel.publishChannel('CTP/ZMQ', { const: ACCOUNT_ID }, () => from(zmqConn.input$));
