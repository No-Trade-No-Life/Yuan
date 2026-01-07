import { defer, from, map, mergeMap, repeat, retry, shareReplay, toArray } from 'rxjs';
import { client } from './api';

const mapSymbolToFundingRate$ = defer(() => client.getFuturesFundingRate()).pipe(
  //
  map((v) => v.data),
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.market, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay(1),
);

const mapSymbolToTicker$ = defer(() => client.getFuturesTicker()).pipe(
  //
  map((v) => v.data),
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.market, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay(1),
);

// provideTicks(terminal, 'COINEX', (product_id) => {
//   const [instType, instId] = decodePath(product_id);
//   if (instType !== 'SWAP') return [];
//   return combineLatest([mapSymbolToTicker$, mapSymbolToMarket$, mapSymbolToFundingRate$]).pipe(
//     //
//     map(([mapSymbolToTicker, mapSymbolToMarket, mapSymbolToFundingRate]): ITick => {
//       const ticker = mapSymbolToTicker.get(instId);
//       const market = mapSymbolToMarket.get(instId);
//       const fundingRate = mapSymbolToFundingRate.get(instId);
//       if (!ticker) {
//         throw new Error(`ticker ${instId} not found`);
//       }
//       if (!market) {
//         throw new Error(`market ${instId} not found`);
//       }
//       if (!fundingRate) {
//         throw new Error(`fundingRate ${instId} not found`);
//       }
//       return {
//         product_id,
//         datasource_id: 'COINEX',
//         updated_at: Date.now(),
//         price: +ticker.last,
//         interest_rate_for_long: -+fundingRate.latest_funding_rate,
//         interest_rate_for_short: +fundingRate.latest_funding_rate,
//         settlement_scheduled_at: +fundingRate.next_funding_time,
//         open_interest: +market.open_interest_volume,
//       };
//     }),
//   );
// });
