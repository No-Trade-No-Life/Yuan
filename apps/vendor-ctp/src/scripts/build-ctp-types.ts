import fs from 'fs';
import path from 'path';
import { filter, from, map, Observable, OperatorFunction, reduce, withLatestFrom } from 'rxjs';
import { IDataTypeMeta, IStructMeta, makeDataTypeMeta, makeStructMeta } from './ctp-meta';

const outPath = path.join(__dirname, '../../src/assets/ctp-types.ts');

const makeTsEnumLiteral: OperatorFunction<IDataTypeMeta, string> = (
  dataTypeMeta$: Observable<IDataTypeMeta>,
) =>
  dataTypeMeta$.pipe(
    //
    filter((meta) => meta.enums.length !== 0),
    map((meta) =>
      [
        `// ${meta.comment}`,
        `export enum ${meta.name} {`,
        ...meta.enums.flatMap((v) => [
          //
          `  // ${v.comment}`,
          `  ${v.key} = '${v.value}',`,
        ]),
        `}`,
        ``,
        ``,
      ].join('\n'),
    ),
    // tap((v) => console.info(v))
  );

const makeTsInterfaceLiteral =
  (dataTypeMeta$: Observable<IDataTypeMeta>): OperatorFunction<IStructMeta, string> =>
  (structMeta$: Observable<IStructMeta>) => {
    const mapTypeNameToDataTypeMeta$ = dataTypeMeta$.pipe(
      //
      reduce(
        (acc: Record<string, IDataTypeMeta>, cur) => ({
          ...acc,
          [cur.name]: cur,
        }),
        {},
      ),
    );
    return structMeta$.pipe(
      //
      withLatestFrom(mapTypeNameToDataTypeMeta$),
      map(([structMeta, mapTypeNameToDataTypeMeta]) =>
        [
          `// ${structMeta.comment}`,
          `export interface I${structMeta.name} {`,
          ...structMeta.fields.flatMap((field) => [
            `  // ${field.comment}`,
            `  ${field.name}: ${
              mapTypeNameToDataTypeMeta[field.type].enums.length !== 0
                ? mapTypeNameToDataTypeMeta[field.type].name
                : mapTypeNameToDataTypeMeta[field.type].type
            };`,
          ]),
          `}`,
          ``,
          ``,
        ].join('\n'),
      ),
    );
  };

const sourceDataTypeLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcUserApiDataType.h'))
  .toString()
  .split('\n');

const sourceStructLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcUserApiStruct.h'))
  .toString()
  .split('\n');

const dataTypeLine$ = from(sourceDataTypeLines);
const structLine$ = from(sourceStructLines);

fs.writeFileSync(
  outPath,
  [
    //
    `// THIS FILE IS AUTO GENERATED`,
    `// DO NOT MODIFY MANUALLY`,
    ``,
    ``,
  ].join('\n'),
);

const dataTypeMeta$ = dataTypeLine$.pipe(
  //
  makeDataTypeMeta,
);

dataTypeMeta$
  .pipe(
    //
    makeTsEnumLiteral,
  )
  .subscribe((v) => {
    // console.info(v);
    fs.appendFileSync(outPath, v);
  });

structLine$
  .pipe(
    //
    makeStructMeta,
    makeTsInterfaceLiteral(dataTypeMeta$),
  )
  .subscribe((v) => {
    // console.info(v);
    fs.appendFileSync(outPath, v);
  });
