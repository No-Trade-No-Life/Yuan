import { Collapse, List, Space } from '@douyinfe/semi-ui';
import {
  ArrayFieldTemplateItemType,
  ArrayFieldTemplateProps,
  FormContextType,
  getTemplate,
  getUiOptions,
  RJSFSchema,
  StrictRJSFSchema,
} from '@rjsf/utils';

/** The `ArrayFieldTemplate` component is the template used to render all items in an array.
 *
 * @param props - The `ArrayFieldTemplateItemType` props for the component
 */
export default function ArrayFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ArrayFieldTemplateProps<T, S, F>) {
  const {
    canAdd,
    disabled,
    idSchema,
    items,
    onAddClick,
    readonly,
    registry,
    required,
    schema,
    title,
    uiSchema,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const ArrayFieldDescriptionTemplate = getTemplate<'ArrayFieldDescriptionTemplate', T, S, F>(
    'ArrayFieldDescriptionTemplate',
    registry,
    uiOptions,
  );
  const ArrayFieldItemTemplate = getTemplate<'ArrayFieldItemTemplate', T, S, F>(
    'ArrayFieldItemTemplate',
    registry,
    uiOptions,
  );
  const ArrayFieldTitleTemplate = getTemplate<'ArrayFieldTitleTemplate', T, S, F>(
    'ArrayFieldTitleTemplate',
    registry,
    uiOptions,
  );
  // Button templates are not overridden in the uiSchema
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  return (
    <List
      className={'Y-ArrayField'}
      header={
        <Space>
          <ArrayFieldDescriptionTemplate
            description={uiOptions.description || schema.description || ''}
            idSchema={idSchema}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />

          <ArrayFieldTitleTemplate
            idSchema={idSchema}
            required={required}
            title={uiOptions.title || title}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        </Space>
      }
      footer={
        canAdd && (
          <AddButton
            className="array-item-add"
            disabled={disabled || readonly}
            onClick={onAddClick}
            uiSchema={uiSchema}
            registry={registry}
          />
        )
      }
    >
      {items &&
        items.map(({ key, ...itemProps }: ArrayFieldTemplateItemType<T, S, F>) => (
          <ArrayFieldItemTemplate
            key={key}
            {...itemProps}
            uiSchema={{ 'ui:title': title, ...itemProps.uiSchema }}
          />
        ))}
    </List>
  );
}
