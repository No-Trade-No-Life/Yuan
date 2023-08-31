import { TextArea } from '@douyinfe/semi-ui';
import {
  ariaDescribedByIds,
  FormContextType,
  GenericObjectType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';
import React from 'react';

const INPUT_STYLE = {
  width: '100%',
};

/** The `TextareaWidget` is a widget for rendering input fields as textarea.
 *
 * @param props - The `WidgetProps` for this component
 */
export default function TextareaWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({
  disabled,
  formContext,
  id,
  onBlur,
  onChange,
  onFocus,
  options,
  placeholder,
  readonly,
  value,
}: WidgetProps<T, S, F>) {
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const handleChange = (value: string, { target }: React.MouseEvent<HTMLTextAreaElement>) =>
    onChange(value === '' ? options.emptyValue : value);

  // const handleBlur = ({ target }: React.MouseEvent<HTMLTextAreaElement>) => onBlur(id, target.value);

  // const handleFocus = ({ target }: React.MouseEvent<HTMLTextAreaElement>) => onFocus(id, target.value);

  // Antd's typescript definitions do not contain the following props that are actually necessary and, if provided,
  // they are used, so hacking them in via by spreading `extraProps` on the component to avoid typescript errors
  const extraProps = {
    type: 'textarea',
  };

  return (
    <TextArea
      disabled={disabled || (readonlyAsDisabled && readonly)}
      id={id}
      name={id}
      // onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleChange : undefined}
      // onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      rows={options.rows || 4}
      style={INPUT_STYLE}
      value={value}
      {...extraProps}
      aria-describedby={ariaDescribedByIds<T>(id)}
    />
  );
}
