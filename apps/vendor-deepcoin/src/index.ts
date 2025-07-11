import { ITick } from '@yuants/data-model';
import { UUID, formatTime } from '@yuants/utils';
import { Terminal, provideTicks } from '@yuants/protocol';
import { Subject, filter, fromEvent, interval, map, mergeMap, tap } from 'rxjs';
import { MessageEvent, WebSocket } from 'ws';

// API Doc: https://www.deepcoin.com/zh/docs#WebSocket-public-address
const ws = new WebSocket('wss://stream.deepcoin.com/public/ws');

const datasource_id = 'DeepCoin';
const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: `DeepCoinAPI/${UUID()}`,
  name: 'DeepCoin API',
});

const tick$ = new Subject<ITick>();

// TODO
// const products$ = defer(() =>
//   fetch(
//     `https://api.deepcoin.com/deepcoin/market/instruments?instType=SWAP`
//   ).then((v) => v.json())
// ).pipe(
//   //
//   mergeAll(),
//   map(
//     (v: any): IProduct => ({
//       datasource_id,
//       product_id: `${v.baseCcy}${v.quoteCcy}`,
//       name: v.InstId,
//       base_currency: v.baseCcy,
//       quote_currency: v.quoteCcy,
//       price_step: v.tickSz,
//       // volume_step: v.ctVal,
//       // value_scale:
//     })
//   ),
//   shareReplay(1)
// );

interval(5000).subscribe(() => {
  ws.send('ping');
});

fromEvent<MessageEvent>(ws, 'message')
  .pipe(
    map((e) => e.data.toString()),
    // tap((x) => {
    //   console.info(formatTime(Date.now()), "RX", x);
    // }),
    filter((x) => x !== 'pong'),
    map((x) => JSON.parse(x)),
    filter((v) => v.action === 'PushMarketDataOverView' && !!v.result),
    // map deepcoin tick to ITick
    mergeMap((v) => v.result),
    map((v: any): ITick => {
      return {
        datasource_id,
        product_id: v.data.InstrumentID,
        //NOTE: rawTick.UpdateMilliSecond should be the millisecond part of rawTick.UpdateTime
        //      yet it's not documented and always be 132 in my test.
        updated_at: v.data.UpdateTime * 1000,
        price: v.data.LastPrice,
        // volume: v.data.Volume,
        ask: v.data.AskPrice1,
        bid: v.data.BidPrice1,
        interest_rate_for_long: -v.data.PositionFeeRate,
        interest_rate_for_short: v.data.PositionFeeRate,
      };
    }),
  )
  .subscribe(tick$);

let LocalNo = 0;

fromEvent(ws, 'close').subscribe(() => {
  console.info(formatTime(Date.now()), 'WS Closed, Exiting...');
  process.exit(0);
});

provideTicks(terminal, datasource_id, (product_id) => {
  console.info(formatTime(Date.now()), 'Subscribing', product_id);
  ws.send(
    JSON.stringify({
      SendTopicAction: {
        Action: '1',
        FilterValue: `DeepCoin_${product_id}`,
        LocalNo: LocalNo++,
        ResumeNo: -1,
        TopicID: '7',
      },
    }),
  );
  return tick$.pipe(
    //
    filter((v) => v.product_id === product_id),
    tap((x) => {
      console.info(formatTime(Date.now()), 'Tick', JSON.stringify(x));
    }),
  );
});
