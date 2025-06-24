import { IDataRecord, IDataRecordTypes } from '@yuants/data-model';
import { EMPTY, bufferCount, concatMap, defer, firstValueFrom, from, map, mergeMap, toArray } from 'rxjs';
import { IQueryDataRecordsRequest } from '../services/data-record';
import { Terminal } from '../terminal';

/**
 * @public
 */
export const readDataRecords = <T extends keyof IDataRecordTypes>(
  terminal: Terminal,
  request: IQueryDataRecordsRequest & { type: T },
) =>
  firstValueFrom(
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
  firstValueFrom(
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
