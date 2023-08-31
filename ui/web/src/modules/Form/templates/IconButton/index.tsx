import { IconArrowDown, IconArrowUp, IconCopyAdd, IconDelete } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { ButtonProps } from '@douyinfe/semi-ui/lib/es/button';
import { FormContextType, getUiOptions, IconButtonProps, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';

// The `type` for IconButtonProps collides with the `type` for `ButtonProps` so omit it to avoid Typescript issue
export type MyIconButtonProps<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
> = Omit<IconButtonProps<T, S, F>, 'type'>;

export default function IconButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: MyIconButtonProps<T, S, F> & ButtonProps) {
  const { iconType = 'primary', icon, uiSchema, registry, ...otherProps } = props;
  return (
    <Button
      type={iconType as any}
      icon={icon}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick?.(e);
      }}
      {...otherProps}
    />
  );
}

export function AddButton<T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: MyIconButtonProps<T, S, F>,
) {
  return <IconButton title="Add Item" {...props} iconType="primary" icon={<IconCopyAdd />} />;
}

export function MoveDownButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: MyIconButtonProps<T, S, F>) {
  return <IconButton title="Move down" {...props} icon={<IconArrowDown />} />;
}

export function MoveUpButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: MyIconButtonProps<T, S, F>) {
  return <IconButton title="Move up" {...props} icon={<IconArrowUp />} />;
}

export function RemoveButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: MyIconButtonProps<T, S, F>) {
  // The `block` prop is not part of the `IconButtonProps` defined in the template, so get it from the uiSchema instead
  const options = getUiOptions<T, S, F>(props.uiSchema);
  return (
    <IconButton
      title="Remove"
      {...props}
      type="danger"
      block={!!options.block}
      iconType="primary"
      icon={<IconDelete />}
    />
  );
}
