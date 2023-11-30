import { Select } from '@douyinfe/semi-ui';
import { t } from 'i18next';
import { useEffect } from 'react';

export const AccountSelector = (props: {
  value: string;
  onChange: (v: string) => void;
  candidates: string[];
}) => {
  useEffect(() => {
    if (props.candidates.length > 0) {
      if (!props.candidates.includes(props.value)) {
        props.onChange(props.candidates[0]);
      }
    }
  }, [props.value, props.candidates]);

  return (
    <Select
      prefix={t('common:account')}
      value={props.value}
      onChange={(v) => {
        props.onChange(v as string);
      }}
      optionList={props.candidates.map((v) => ({ label: v, value: v }))}
    ></Select>
  );
};
