import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { catchError, filter, from, map, Observable, takeWhile, timeout } from 'rxjs';
import { createZMQConnection, IBridgeMessage } from './bridge';

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
  process.env.ZMQ_PULL_URL || 'tcp://localhost:5700',
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
      method: { type: 'string' },
      params: { type: 'object', additionalItems: true },
    },
  },
  (msg) =>
    _requestZMQ({
      method: msg.req.method,
      params: msg.req.params,
    }).pipe(map((x) => ({ frame: x }))),
  {
    concurrent: 1,
    global_token_capacity: 1,
    max_pending_requests: 10,
  },
);

export const requestZMQ = <Req, Res>(req: {
  method: string;
  params: Req;
}): Observable<IBridgeMessage<Req, Res>> =>
  terminal.client
    .requestService<any, any, IBridgeMessage<Req, Res>>('CTP/Query', {
      account_id: ACCOUNT_ID,
      method: req.method,
      params: req.params,
    })
    .pipe(
      //
      map((msg) => msg.frame),
      filter((x): x is Exclude<typeof x, undefined> => Boolean(x)),
    );
