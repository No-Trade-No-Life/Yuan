import { IDataRecord, IOrder, IPeriod, IProduct } from '@yuants/data-model';
import { EMPTY, Observable, bufferCount, concatMap, from, map, mergeMap, toArray } from 'rxjs';
import { IQueryDataRecordsRequest } from '../services/data-record';
import { Terminal } from '../terminal';

/**
 * @public
 */
export interface IDataRecordTypes {
  product: IProduct;
  period: IPeriod;
  order: IOrder;
}

/**
 * @public
 */
export const readDataRecords = <T extends keyof IDataRecordTypes>(
  terminal: Terminal,
  request: IQueryDataRecordsRequest & { type: T },
): Observable<IDataRecord<IDataRecordTypes[T]>[]> =>
  terminal.requestService('QueryDataRecords', request).pipe(
    mergeMap((msg) => {
      if (msg.frame) {
        return msg.frame as IDataRecord<IDataRecordTypes[T]>[];
      }
      if (msg.res) {
        if (msg.res.code !== 0) {
          throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
        }
      }
      return EMPTY;
    }),
    toArray(),
  );

/**
 * @public
 */
export const writeDataRecords = <T extends keyof IDataRecordTypes>(
  terminal: Terminal,
  data: IDataRecord<IDataRecordTypes[T]>[],
): Observable<void> =>
  from(data).pipe(
    bufferCount(2000),
    concatMap((records) =>
      terminal.requestService('UpdateDataRecords', records).pipe(
        map((msg) => {
          if (msg.res) {
            if (msg.res.code !== 0) {
              throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
            }
          }
        }),
      ),
    ),
    toArray(),
    map(() => void 0),
  );
