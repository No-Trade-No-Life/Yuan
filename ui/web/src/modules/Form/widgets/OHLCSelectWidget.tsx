import { IconSearch } from '@douyinfe/semi-icons';
import { AutoComplete } from '@douyinfe/semi-ui';
import { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import { decodePath } from '@yuants/utils';
import { Fzf } from 'fzf';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
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

const HighlightChars = (props: { str: string; indices: Set<number> }) => {
  const chars = props.str.split('');

  const nodes = chars.map((char, i) => {
    if (props.indices.has(i)) {
      return <b key={i}>{char}</b>;
    } else {
      return char;
    }
  });

  return <>{nodes}</>;
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

  const fzf = useMemo(() => {
    return new Fzf(options, {
      selector: (item) => item.label,
    });
  }, [options]);

  // ISSUE: fzf.find(undefined) will throw Error
  const entries = useMemo(() => fzf.find(props.value || ''), [props.value, fzf]);
  const candidates = useMemo(() => entries.map((x) => ({ ...x.item, entry: x })), [entries]);

  interface Option {
    label: string;
    value: string;
    entry: (typeof entries)[number];
  }

  return (
    <AutoComplete<Option>
      style={{ width: '100%', minWidth: 240 }}
      prefix={<IconSearch />}
      value={props.value}
      data={candidates}
      showClear
      onChange={(x: any) => {
        props.onChange(x);
      }}
      renderItem={(option: Option) => {
        return (
          <div>
            <div>
              <HighlightChars str={option.label} indices={option.entry.positions} />
            </div>
            <pre>{option.value}</pre>
          </div>
        );
      }}
      emptyContent={null}
      placeholder="K线品种选择"
    ></AutoComplete>
  );
}
