import { Observable, from, groupBy, map, mergeMap, reduce, toArray } from 'rxjs';
import { IAccountInfo, IPosition } from './interface';

/**
 * Merge Positions by their product_id and direction
 * @public
 */
export const mergeAccountInfoPositions = (info: IAccountInfo): Observable<IAccountInfo> => {
  return from(info.positions).pipe(
    groupBy((position) => position.product_id),
    mergeMap((groupWithSameProductId) =>
      groupWithSameProductId.pipe(
        groupBy((position) => position.direction),
        mergeMap((groupWithSameVariant) =>
          groupWithSameVariant.pipe(
            reduce(
              (acc: IPosition, cur: IPosition): IPosition => ({
                ...acc,
                volume: acc.volume + cur.volume,
                free_volume: acc.free_volume + cur.free_volume,
                position_price:
                  (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                  (acc.volume + cur.volume),
                floating_profit: acc.floating_profit + cur.floating_profit,
                closable_price:
                  (acc.closable_price * acc.volume + cur.closable_price * cur.volume) /
                  (acc.volume + cur.volume),
                valuation: acc.valuation + cur.valuation,
              }),
            ),
          ),
        ),
      ),
    ),
    toArray(),
    map((positions): IAccountInfo => ({ ...info, positions })),
  );
};
