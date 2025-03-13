import { FormContextType, RJSFSchema, StrictRJSFSchema, UnsupportedFieldProps } from '@rjsf/utils';
import { useEffect, useState } from 'react';

export default function UnsupportedFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: UnsupportedFieldProps<T, S, F>) {
  // 统一 fallback
  const { idSchema, registry, schema } = props;
  const [, setState] = useState(0);

  useEffect(() => {
    if (schema.type === undefined) {
      if (typeof schema.const === 'string') {
        schema.type = 'string';
      }
    }
    setState((prev) => prev + 1);
  }, []);

  return <div>{props.reason}</div>;
}
