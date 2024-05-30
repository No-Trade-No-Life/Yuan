import { IconSearch } from '@douyinfe/semi-icons';
import { AutoComplete } from '@douyinfe/semi-ui';
import { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import { Fzf } from 'fzf';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { accountIds$ } from '../../AccountInfo/model';
import { InlineAccountId } from '../../AccountInfo';

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

export function AccountIdWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WidgetProps<T, S, F>) {
  const data = useObservableState(accountIds$, []);

  const options = useMemo(() => {
    return data.map((v) => {
      return {
        label: v,
        value: v,
      };
    });
  }, [data]);

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
    <>
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
        placeholder="选择账户"
      ></AutoComplete>
      <InlineAccountId account_id={props.value} />
    </>
  );
}
