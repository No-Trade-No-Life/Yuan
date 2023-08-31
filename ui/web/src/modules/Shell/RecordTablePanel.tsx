import { Descriptions, List, Select, Space, Typography } from '@douyinfe/semi-ui';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useMemo, useState } from 'react';
import { from, groupBy, map, mergeMap, pipe, toArray } from 'rxjs';
import { recordTable$ } from './model';

export const RecordTablePanel = React.memo(() => {
  const recordTable = useObservableState(recordTable$);
  const [tableName, setTableName] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);

  const tableNames = useMemo(() => Object.keys(recordTable), [recordTable]);

  const originData = useMemo(() => recordTable[tableName] || [], [recordTable, tableName]);
  const properties = useMemo(() => Object.keys(originData[0] || {}), [originData]);

  const data = useObservableState(
    useObservable(
      pipe(
        mergeMap(([originData, rows, values]) =>
          from(originData).pipe(
            groupBy((record) => rows.map((rowKey) => `${rowKey}=${record[rowKey]}`).join()),
            mergeMap((group) =>
              group.pipe(
                toArray(),
                map((samples) => {
                  const output = values.map((value, idx) => {
                    const [method, propName] = value.split(':');
                    const nonNaNSamples = samples.map((x) => +x[propName]).filter((v) => !Number.isNaN(v));

                    if (method === 'sum') {
                      return {
                        label: value,
                        value: nonNaNSamples.reduce((acc, cur) => acc + cur, 0),
                      };
                    }
                    if (method === 'count') {
                      return {
                        label: value,
                        value: samples.length,
                      };
                    }
                    if (method === 'avg') {
                      return {
                        label: value,
                        value: nonNaNSamples.reduce((acc, cur) => acc + cur, 0) / nonNaNSamples.length,
                      };
                    }
                    return {
                      label: value,
                      value: NaN,
                    };
                  });
                  return {
                    values: output,
                    groupKey: group.key,
                    samples: samples.length,
                  };
                }),
              ),
            ),
            toArray(),
            map((arr) => arr.sort((a, b) => a.groupKey.localeCompare(b.groupKey))),
          ),
        ),
      ),
      [originData, groups, values],
    ),
    [],
  );

  return (
    <Space vertical align="start">
      <Select
        prefix="表"
        value={tableName}
        onChange={(v) => {
          if (typeof v === 'string') {
            setTableName(v);
          }
        }}
        optionList={tableNames.map((k) => ({ value: k, label: k }))}
      ></Select>
      <Select
        prefix="组"
        multiple
        value={groups}
        onChange={(e) => {
          setGroups(e as string[]);
        }}
        optionList={properties.map((k) => ({ value: k, label: k }))}
      ></Select>

      <Select
        prefix="值"
        multiple
        value={values}
        onChange={(e) => {
          setValues(e as string[]);
        }}
        optionList={properties.flatMap((k) => [
          {
            label: `计数:${k}`,
            value: `count:${k}`,
          },
          {
            label: `求和:${k}`,
            value: `sum:${k}`,
          },
          {
            label: `平均值:${k}`,
            value: `avg:${k}`,
          },
        ])}
      ></Select>
      <Typography.Text>
        总样本数: {originData.length} 组数: {data.length}
      </Typography.Text>
      <List
        dataSource={data}
        renderItem={(item) => (
          <List.Item>
            <div>
              <Descriptions
                data={[
                  { key: '组别', value: item.groupKey || '*' },
                  { key: '组内样本', value: item.samples },
                ]}
              />
              <List
                dataSource={item.values}
                renderItem={(x) => (
                  <List.Item>
                    <div>
                      <div>{x.label}</div>
                      <div>{x.value}</div>
                    </div>
                  </List.Item>
                )}
              ></List>
            </div>
          </List.Item>
        )}
      ></List>
    </Space>
  );
});
