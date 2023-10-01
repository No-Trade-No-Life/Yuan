import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Space, Tooltip, Typography } from '@douyinfe/semi-ui';
import {
  FieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  getTemplate,
  getUiOptions,
} from '@rjsf/utils';
import { useTranslation } from 'react-i18next';

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
    disabled,
    hidden,
    id,
    label,
    onDropPropertyClick,
    onKeyChange,
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
  const ns = props.formContext?.['i18n:ns'] ?? 'schemas';
  const { i18n } = useTranslation(ns);
  const i18nKeyTitle = `${ns}:${id}.title`;
  const i18nTitle = i18n.exists(i18nKeyTitle) ? i18n.t(i18nKeyTitle) : props.label;
  const i18nKeyDescription = `${ns}:${id}.description`;
  const i18nDescription = i18n.exists(i18nKeyDescription)
    ? i18n.t(i18nKeyDescription)
    : props.schema.description;

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
            <Typography.Text strong>{i18nTitle}</Typography.Text>
            {i18nDescription ? (
              <Tooltip position="left" style={{ minWidth: 180 }} content={i18nDescription}>
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
