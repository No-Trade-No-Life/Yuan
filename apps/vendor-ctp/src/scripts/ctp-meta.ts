import {
  filter,
  first,
  forkJoin,
  from,
  map,
  mergeAll,
  mergeMap,
  Observable,
  OperatorFunction,
  pairwise,
  reduce,
  skip,
  take,
  toArray,
  zipWith,
} from 'rxjs';
export interface IDataTypeMeta {
  name: string;
  type: string;
  originType: string;
  comment: string;
  length: number;
  enums: {
    value: string;
    key: string;
    comment: string;
  }[];
}

export interface IStructMeta {
  name: string;
  comment: string;
  fields: {
    type: string;
    name: string;
    comment: string;
  }[];
}

export const mapCTypeToTsType: Record<string, string> = {
  double: 'number',
  char: 'string',
  int: 'number',
  short: 'number',
};

export const mapCTypeToBinaryParserBuilder: Record<string, string> = {
  int: 'int32le',
  short: 'int16le',
  char: 'string',
  double: 'doublele',
};

// const TRADER_API_META = [

// ]

const sectionDelimiter = '/////////////////////////////////////////////////////////////////////////';

/**
 * extract type meta from CTP header file
 *
 * @param line$ lines from CTP header file `ThostFtdcUserApiDataType.h`
 * @returns IDataTypeMeta
 *
 * e.g.
 *
 * /////////////////////////////////////////////////////////////////////////
 * ///TFtdcResponseValueType是一个应答类型类型
 * /////////////////////////////////////////////////////////////////////////
 * ///检查成功
 * #define THOST_FTDC_RV_Right '0'
 * ///检查失败
 * #define THOST_FTDC_RV_Refuse '1'
 *
 * typedef char TThostFtdcResponseValueType;
 *
  {
    name: 'TThostFtdcResponseValueType',
    type: 'string',
    comment: 'TFtdcResponseValueType是一个应答类型类型',
    length: 1,
    enums: [
      {
        key: 'THOST_FTDC_RV_Refuse',
        value: '1',
        comment: '检查失败'
      },
      {
        key: 'THOST_FTDC_RV_Right',
        value: '0',
        comment: '检查成功'
      }
    ]
  }
 */
export const makeDataTypeMeta: OperatorFunction<string, IDataTypeMeta> = (
  line$: Observable<string>,
): Observable<IDataTypeMeta> =>
  line$.pipe(
    //
    pairwise(),
    reduce((acc: string[][], cur: [string, string]) => {
      if (cur[0] === '' && cur[1] === sectionDelimiter) {
        return [...acc, []];
      }
      return !!acc[acc.length - 1]
        ? [...acc.slice(0, acc.length - 1), [...acc[acc.length - 1], cur[0]]]
        : [...acc.slice(0, acc.length - 1), [cur[0]]];
    }, []),
    mergeAll(),
    mergeMap((section) => {
      const line$ = from(section);
      const typeInfo$ = line$.pipe(
        //
        map((line): [string, string, string, number] | undefined => {
          const matchGroup = line.match(/typedef (double|char|int|short) (\w+)(\[(\d+)\])?;/);
          if (matchGroup) {
            return [matchGroup[2], mapCTypeToTsType[matchGroup[1]], matchGroup[1], +(matchGroup[4] ?? '1')];
          }
        }),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
      );
      const comment$ = line$.pipe(
        //
        map((line) => {
          const group = line.match(/\/\/\/([^\/]+)/);
          if (group) {
            return group[1];
          }
        }),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
      );
      const enumVal$ = line$.pipe(
        //
        map((line) => {
          const group = line.match(/#define (\w+) (.*)/);
          if (group) {
            return [group[1], group[2]];
          }
        }),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
      );
      const sectionComment$ = comment$.pipe(first());
      const enums$ = comment$.pipe(
        //
        skip(1),
        zipWith(enumVal$),
        map(([comment, [key, value]]) => ({ comment, key, value: eval(value) })),
        toArray(),
      );
      return forkJoin([sectionComment$, enums$, typeInfo$]).pipe(
        //
        map(([comment, enums, [name, type, originType, length]]) => ({
          name,
          type,
          originType,
          comment,
          length,
          enums,
        })),
      );
    }),
  );

export const makeStructMeta = (line$: Observable<string>) =>
  line$.pipe(
    //
    pairwise(),
    reduce((acc: string[][], cur: [string, string]) => {
      if (cur[0] === '' && cur[1].startsWith('///')) {
        return [...acc, []];
      }
      return !!acc[acc.length - 1]
        ? [...acc.slice(0, acc.length - 1), [...acc[acc.length - 1], cur[0]]]
        : [...acc.slice(0, acc.length - 1), [cur[0]]];
    }, []),
    mergeAll(),
    // tap((v) => console.info(v)),
    mergeMap((section) => {
      const line$ = from(section);
      const name$ = line$.pipe(
        //
        take(2),
        toArray(),
        map(([commentLine, titleLine]) => {
          const comment = commentLine.match(/\/\/\/([^\/]+)/);
          const name = titleLine.match(/struct (\w+)/);
          if (comment && name) {
            return [comment[1], name[1]];
          }
        }),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        // tap((v) => console.info('NAME', v))
      );
      name$.subscribe();
      const fieldComment$ = line$.pipe(
        skip(2),
        map((line) => line.match(/\s\/\/\/([^\/]+)/)?.[1]),
        filter((v): v is Exclude<typeof v, null | undefined> => !!v),
        // tap((v) => console.info('FIELD COMMENT', v))
      );
      fieldComment$.subscribe();
      const fieldInfo$ = line$.pipe(
        skip(2),
        map((line) => {
          const groups = line.match(/\s(\w+)\s(\w+);/);
          if (groups) {
            return [groups[1], groups[2]];
          }
        }),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        // tap((v) => console.info('FIELD INFO', v))
      );
      fieldInfo$.subscribe();
      const fields$ = fieldComment$.pipe(
        zipWith(fieldInfo$),
        map(([comment, [type, name]]) => ({ comment, type, name })),
        toArray(),
        // tap((v) => console.info('FIELD', v))
      );
      fields$.subscribe();
      return forkJoin([name$, fields$]).pipe(
        //
        map(
          ([[comment, name], fields]): IStructMeta => ({
            name,
            comment,
            fields,
          }),
        ),
      );
    }),
    // tap((v) => console.info(v))
  );

export const makeFileContent = (source$: Observable<string>) =>
  source$.pipe(
    //
    toArray(),
    map((v) => v.join('\n\n')),
  );
