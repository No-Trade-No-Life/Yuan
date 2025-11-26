// import { IConnection, createConnectionWs } from '@yuants/protocol';
// import { Subject, filter, from, map, share, tap } from 'rxjs';
// import zlib from 'zlib';
// import { ICredential } from './api/private-api';

// interface IHuobiParams {
//   auth: ICredential;
// }

// const createConnectionGzipWS = <T = any>(URL: string): IConnection<T> => {
//   const conn = createConnectionWs(URL);
//   const input$ = from(conn.input$).pipe(
//     map((msg) => zlib.gunzipSync(msg)),
//     map((msg) => msg.toString()),
//     map((msg) => JSON.parse(msg)),
//     share(),
//   );

//   const output$ = new Subject<any>();
//   output$.pipe(map((msg) => JSON.stringify(msg))).subscribe(conn.output$);
//   return {
//     ...conn,
//     input$: input$,
//     output$: output$,
//   };
// };

// export class HuobiClient {
//   // https://www.htx.com/zh-cn/opend/newApiPages/?id=510
//   swap_api_root = 'api.hbdm.com';
//   // https://www.htx.com/zh-cn/opend/newApiPages/?id=404
//   spot_api_root = 'api.huobi.pro';

//   spot_ws: IConnection<any>;

//   constructor(public params: IHuobiParams) {
//     this.spot_ws = createConnectionGzipWS(`wss://${this.spot_api_root}/ws`);
//     from(this.spot_ws.input$)
//       .pipe(
//         //
//         filter((v) => v.ping),
//         tap((v) => {
//           this.spot_ws.output$.next({ pong: v.ping });
//         }),
//       )
//       .subscribe();
//   }

//   // swap_ws = new WebSocket(new URL(`wss://${this.swap_api_root}/linear-swap-ws`));
// }

// export const client = new HuobiClient({
//   auth: {
//     access_key: process.env.ACCESS_KEY!,
//     secret_key: process.env.SECRET_KEY!,
//   },
// });
