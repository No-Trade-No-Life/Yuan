import { IconSearch } from '@douyinfe/semi-icons';
import { AutoComplete } from '@douyinfe/semi-ui';
import { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import { decodePath } from '@yuants/agent';
import Fuse from 'fuse.js';
import { useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { OHLCIdList$ } from '../../Workbench/model';

const mapPeriodInSecToReadable: Record<string, string> = {
  60: '1分钟',
  300: '5分钟',
  900: '15分钟',
  1800: '30分钟',
  3600: '1小时',
  14400: '4小时',
  86400: '1日',
};

export function OHLCSelectWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WidgetProps<T, S, F>) {
  const OHLCIdList = useObservableState(OHLCIdList$);

  const options = useMemo(() => {
    return OHLCIdList.map((v) => {
      const [datasource_id, product_id, period_in_sec] = decodePath(v);
      return {
        label: `${datasource_id} / ${product_id} / ${mapPeriodInSecToReadable[period_in_sec]}`,
        value: v,
      };
    });
  }, [OHLCIdList]);

  const fuse = useMemo(() => {
    return new Fuse(options, {
      keys: ['label'],
    });
  }, [options]);

  const [candidates, setCandidates] = useState(options);

  return (
    <AutoComplete
      style={{ width: '100%', minWidth: 240 }}
      prefix={<IconSearch />}
      value={props.value}
      data={candidates}
      showClear
      onChange={(x: any) => {
        props.onChange(x);
      }}
      onSearch={(x: string) => {
        if (x === '') {
          setCandidates(options);
        } else {
          setCandidates(fuse.search(x).map((v) => v.item));
        }
      }}
      emptyContent={null}
      placeholder="K线品种选择"
    ></AutoComplete>
  );
}
