import { IDataRecord, IOrder, IPeriod, IProduct } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { EMPTY, bufferCount, concatMap, defer, from, map, mergeMap, of, toArray } from 'rxjs';
import {
  ICopyDataRecordsRequest,
  IQueryDataRecordsRequest,
  IRemoveDataRecordsRequest,
} from '../services/data-record';
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
) =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('QueryDataRecords', request)).pipe(
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
    ),
  );

/**
 * @public
 */
export const writeDataRecords = <T extends keyof IDataRecordTypes>(
  terminal: Terminal,
  data: IDataRecord<IDataRecordTypes[T]>[],
) =>
  observableToAsyncIterable(
    from(data).pipe(
      bufferCount(2000),
      concatMap((records: IDataRecord<IDataRecordTypes[T]>[]) =>
        defer(() => terminal.requestService('UpdateDataRecords', records)).pipe(
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
    ),
  );

/**
 * @public
 */
export const copyDataRecords = (terminal: Terminal, req: ICopyDataRecordsRequest) =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('CopyDataRecords', req)).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
          // emit an signal to indicate that the copy is complete
          return of(void 0);
        }
        return EMPTY;
      }),
      toArray(),
      map(() => void 0),
    ),
  );

/**
 * @public
 */
export const queryDataRecords = <T>(
  terminal: Terminal,
  req: IQueryDataRecordsRequest,
): AsyncIterable<IDataRecord<T>> =>
  observableToAsyncIterable(
    defer(() => readDataRecords(terminal, req as any)).pipe(mergeMap((x) => x)),
  ) as any;

/**
 * @public
 */
export const removeDataRecords = (terminal: Terminal, req: IRemoveDataRecordsRequest): AsyncIterable<void> =>
  observableToAsyncIterable(
    defer(() => terminal.requestService('RemoveDataRecords', req)).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
        }
        return EMPTY;
      }),
      toArray(),
      map(() => void 0),
    ),
  );
