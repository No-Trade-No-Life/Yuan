import { Select } from '@douyinfe/semi-ui';
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

/** The `SelectWidget` is a widget for rendering dropdowns.
 *  It is typically used with string properties constrained with enum options.
 *
 * @param props - The `WidgetProps` for this component
 */
export default function SelectWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({
  label,
  autofocus,
  disabled,
  formContext = {} as F,
  id,
  multiple,
  onBlur,
  onChange,
  onFocus,
  options,
  placeholder,
  readonly,
  value,
}: WidgetProps<T, S, F>) {
  const { readonlyAsDisabled = true } = formContext as GenericObjectType;

  const { enumOptions, enumDisabled, emptyValue } = options;

  const handleChange = (nextValue: any) =>
    onChange(enumOptionsValueForIndex<S>(nextValue, enumOptions, emptyValue));

  const handleBlur = () => onBlur(id, enumOptionsValueForIndex<S>(value, enumOptions, emptyValue));

  const handleFocus = () => onFocus(id, enumOptionsValueForIndex<S>(value, enumOptions, emptyValue));

  // const filterOption = (input: string, option?: DefaultOptionType) => {
  //   if (option && typeof option.label === 'string') {
  //     // labels are strings in this context
  //     return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
  //   }
  //   return false;
  // };

  // const getPopupContainer = (node: any) => node.parentNode;

  const selectedIndexes = enumOptionsIndexForValue<S>(value, enumOptions, multiple);

  // Antd's typescript definitions do not contain the following props that are actually necessary and, if provided,
  // they are used, so hacking them in via by spreading `extraProps` on the component to avoid typescript errors
  const extraProps = {
    name: id,
  };
  return (
    <Select
      filter
      autoFocus={autofocus}
      disabled={disabled || (readonlyAsDisabled && readonly)}
      virtualize={(enumOptions?.length ?? 0) > 100 ? { itemSize: 42 } : undefined}
      // getPopupContainer={getPopupContainer}
      id={id}
      multiple={multiple}
      onBlur={!readonly ? handleBlur : undefined}
      onChange={!readonly ? handleChange : undefined}
      onFocus={!readonly ? handleFocus : undefined}
      placeholder={placeholder}
      style={{
        width: '100%',
        minWidth: 240,
        height: 32,
      }}
      value={selectedIndexes}
      {...extraProps}
      // filterOption={filterOption}
      aria-describedby={ariaDescribedByIds<T>(id)}
    >
      {Array.isArray(enumOptions) &&
        enumOptions.map(({ value: optionValue, label: optionLabel }, index) => (
          <Select.Option
            disabled={Array.isArray(enumDisabled) && enumDisabled.indexOf(optionValue) !== -1}
            key={String(index)}
            value={String(index)}
          >
            {optionLabel}
          </Select.Option>
        ))}
    </Select>
  );
}
