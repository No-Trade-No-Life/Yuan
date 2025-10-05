import { IconSearch } from '@douyinfe/semi-icons';
import { AutoComplete as SemiAutoComplete } from '@douyinfe/semi-ui';
import { AutoCompleteProps } from '@douyinfe/semi-ui/lib/es/autoComplete';
import { Fzf } from 'fzf';
import { useMemo } from 'react';

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

export function AutoComplete(
  props: Omit<AutoCompleteProps<{ label: string; value: string }>, 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
  },
) {
  const fzf = useMemo(() => {
    return new Fzf(props.data || [], {
      selector: (item) => item.label,
      limit: 200,
    });
  }, [props.data]);

  // ISSUE: fzf.find(undefined) will throw Error
  const entries = useMemo(() => fzf.find(props.value?.toString() || ''), [props.value, fzf]);
  const candidates = useMemo(() => entries.map((x) => ({ ...x.item, entry: x })), [entries]);

  interface Option {
    label: string;
    value: string;
    entry: (typeof entries)[number];
  }

  return (
    <SemiAutoComplete<Option>
      {...props}
      defaultValue={undefined}
      value={props.value}
      onChange={(v) => {
        props.onChange(v.toString());
      }}
      loading={props.data === undefined}
      style={{ minWidth: 240 }}
      prefix={<IconSearch />}
      data={candidates}
      showClear
      renderItem={(option) => {
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
    />
  );
}
