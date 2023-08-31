import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Space, Tooltip, Typography } from '@douyinfe/semi-ui';
import {
  FieldTemplateProps,
  FormContextType,
  getTemplate,
  getUiOptions,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';

/** The `FieldTemplate` component is the template used by `SchemaField` to render any field. It renders the field
 * content, (label, description, children, errors and help) inside of a `WrapIfAdditional` component.
 *
 * @param props - The `FieldTemplateProps` for this component
 */
export function FieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: FieldTemplateProps<T, S, F>) {
  const {
    children,
    classNames,
    style,
    description,
    disabled,
    displayLabel,
    errors,
    formContext,
    help,
    hidden,
    id,
    label,
    onDropPropertyClick,
    onKeyChange,
    rawErrors,
    rawDescription,
    rawHelp,
    readonly,
    registry,
    required,
    schema,
    uiSchema,
  } = props;

  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const WrapIfAdditionalTemplate = getTemplate<'WrapIfAdditionalTemplate', T, S, F>(
    'WrapIfAdditionalTemplate',
    registry,
    uiOptions,
  );

  if (hidden) {
    return <div className="YField-hidden">{children}</div>;
  }

  return (
    <div className="YField">
      <WrapIfAdditionalTemplate
        classNames={classNames}
        style={style}
        disabled={disabled}
        id={id}
        label={label}
        onDropPropertyClick={onDropPropertyClick}
        onKeyChange={onKeyChange}
        readonly={readonly}
        required={required}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
      >
        <Space vertical align="start">
          <Space>
            <Typography.Text strong>{props.label}</Typography.Text>
            {props.schema.description ? (
              <Tooltip position="left" style={{ minWidth: 180 }} content={props.schema.description}>
                <IconInfoCircle />
              </Tooltip>
            ) : null}
          </Space>
          {props.children}
        </Space>
      </WrapIfAdditionalTemplate>
    </div>
  );
}
