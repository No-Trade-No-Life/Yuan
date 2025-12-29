import { IconSearch } from '@douyinfe/semi-icons';
import { AutoComplete } from '@douyinfe/semi-ui';
import { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import { requestSQL } from '@yuants/sql';
import { Fzf } from 'fzf';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { defer, filter, map, retry, switchMap } from 'rxjs';
import { terminal$ } from '../../Network';

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

const seriesIdList$ = terminal$.pipe(
  filter((x): x is Exclude<typeof x, null> => !!x),
  switchMap((terminal) =>
    defer(() =>
      requestSQL<{ series_id: string }[]>(
        terminal,
        `select distinct series_id from series_data_range where table_name = 'ohlc_v2'`,
      ),
    ).pipe(
      retry({ delay: 10_000 }),
      map((x) => x.map((v) => v.series_id)),
    ),
  ),
);

export function OHLCSelectWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WidgetProps<T, S, F>) {
  const OHLCIdList = useObservableState(seriesIdList$, []);

  const options = useMemo(() => {
    return OHLCIdList.map((v) => {
      return {
        label: v,
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
