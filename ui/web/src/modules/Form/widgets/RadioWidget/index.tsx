import { Radio } from '@douyinfe/semi-ui';
import { RadioChangeEvent } from '@douyinfe/semi-ui/lib/es/radio';
import {
  ariaDescribedByIds,
  enumOptionsIndexForValue,
  enumOptionsValueForIndex,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';
import React from 'react';

/** The `RadioWidget` is a widget for rendering a radio group.
 *  It is typically used with a string property constrained with enum options.
 *
 * @param props - The `WidgetProps` for this component
 */
export default function RadioWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({
  autofocus,
  disabled,
  formContext,
  id,
  onBlur,
  onChange,
  onFocus,
  options,
  readonly,
  value,
}: WidgetProps<T, S, F>) {
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const { enumOptions, enumDisabled, emptyValue } = options;

  const handleChange = ({ target: { value: nextValue } }: RadioChangeEvent) =>
    onChange(enumOptionsValueForIndex<S>(nextValue, enumOptions, emptyValue));

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) =>
    onBlur(id, enumOptionsValueForIndex<S>(target.value, enumOptions, emptyValue));

  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) =>
    onFocus(id, enumOptionsValueForIndex<S>(target.value, enumOptions, emptyValue));

  const selectedIndexes = enumOptionsIndexForValue<S>(value, enumOptions) as string;

  return (
    <Radio.Group
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      onChange={!readonly ? handleChange : undefined}
      // onBlur={!readonly ? handleBlur : undefined}
      // onFocus={!readonly ? handleFocus : undefined}
      value={selectedIndexes}
      aria-describedby={ariaDescribedByIds<T>(id)}
    >
      {Array.isArray(enumOptions) &&
        enumOptions.map((option, i) => (
          <Radio
            // id={optionId(id, i)}

            name={id}
            autoFocus={i === 0 ? autofocus : false}
            disabled={Array.isArray(enumDisabled) && enumDisabled.indexOf(value) !== -1}
            key={i}
            value={String(i)}
          >
            {option.label}
          </Radio>
        ))}
    </Radio.Group>
  );
}
