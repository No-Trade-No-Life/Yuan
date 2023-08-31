import React from 'react';
import {
  ADDITIONAL_PROPERTY_FLAG,
  UI_OPTIONS_KEY,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WrapIfAdditionalTemplateProps,
} from '@rjsf/utils';
import { Card, Col, Input, Row, Space } from '@douyinfe/semi-ui';

/** The `WrapIfAdditional` component is used by the `FieldTemplate` to rename, or remove properties that are
 * part of an `additionalProperties` part of a schema.
 *
 * @param props - The `WrapIfAdditionalProps` for this component
 */
export default function WrapIfAdditionalTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WrapIfAdditionalTemplateProps<T, S, F>) {
  const {
    children,
    classNames,
    style,
    disabled,
    id,
    label,
    onDropPropertyClick,
    onKeyChange,
    readonly,
    required,
    registry,
    schema,
    uiSchema,
  } = props;

  // Button templates are not overridden in the uiSchema
  const { RemoveButton } = registry.templates.ButtonTemplates;

  const additional = ADDITIONAL_PROPERTY_FLAG in schema;

  if (!additional) {
    return (
      <div className={'Y-WrapIfAdditional no-additional'} style={style}>
        {children}
      </div>
    );
  }

  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) => onKeyChange(target.value);

  return (
    <div className={'Y-WrapIfAdditional'} style={style}>
      <Card
        title={
          <Input
            prefix="字段名"
            className="form-control"
            defaultValue={label}
            disabled={disabled || readonly}
            id={`${id}-key`}
            name={`${id}-key`}
            onBlur={!readonly ? handleBlur : undefined}
            type="text"
          />
        }
        headerExtraContent={
          <RemoveButton
            disabled={disabled || readonly}
            onClick={onDropPropertyClick(label)}
            uiSchema={uiSchema}
            registry={registry}
          />
        }
      >
        {children}
      </Card>
    </div>
  );
}
