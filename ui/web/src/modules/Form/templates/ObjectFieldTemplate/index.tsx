import { Space } from '@douyinfe/semi-ui';
import {
  canExpand,
  FormContextType,
  getTemplate,
  getUiOptions,
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
  RJSFSchema,
  StrictRJSFSchema,
  titleId,
  UiSchema,
} from '@rjsf/utils';

/** The `ObjectFieldTemplate` is the template to use to render all the inner properties of an object along with the
 * title and description if available. If the object is expandable, then an `AddButton` is also rendered after all
 * the properties.
 *
 * @param props - The `ObjectFieldTemplateProps` for this component
 */
export default function ObjectFieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: ObjectFieldTemplateProps<T, S, F>) {
  const {
    description,
    disabled,
    formContext,
    formData,
    idSchema,
    onAddClick,
    properties,
    readonly,
    required,
    registry,
    schema,
    title,
    uiSchema,
  } = props;
  const uiOptions = getUiOptions<T, S, F>(uiSchema);
  const TitleFieldTemplate = getTemplate<'TitleFieldTemplate', T, S, F>(
    'TitleFieldTemplate',
    registry,
    uiOptions,
  );

  // Button templates are not overridden in the uiSchema
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  const findSchema = (element: ObjectFieldTemplatePropertyType): S => element.content.props.schema;

  const findSchemaType = (element: ObjectFieldTemplatePropertyType) => findSchema(element).type;

  const findUiSchema = (element: ObjectFieldTemplatePropertyType): UiSchema<T, S, F> | undefined =>
    element.content.props.uiSchema;

  const findUiSchemaField = (element: ObjectFieldTemplatePropertyType) =>
    getUiOptions(findUiSchema(element)).field;

  const findUiSchemaWidget = (element: ObjectFieldTemplatePropertyType) =>
    getUiOptions(findUiSchema(element)).widget;

  // const calculateColSpan = (element: ObjectFieldTemplatePropertyType) => {
  //   const type = findSchemaType(element);
  //   const field = findUiSchemaField(element);
  //   const widget = findUiSchemaWidget(element);

  //   const defaultColSpan =
  //     properties.length < 2 || // Single or no field in object.
  //     type === 'object' ||
  //     type === 'array' ||
  //     widget === 'textarea'
  //       ? 24
  //       : 12;

  //   if (typeof colSpan === 'object') {
  //     const colSpanObj: GenericObjectType = colSpan;
  //     if (typeof widget === 'string') {
  //       return colSpanObj[widget];
  //     }
  //     if (typeof field === 'string') {
  //       return colSpanObj[field];
  //     }
  //     if (typeof type === 'string') {
  //       return colSpanObj[type];
  //     }
  //   }
  //   if (typeof colSpan === 'number') {
  //     return colSpan;
  //   }
  //   return defaultColSpan;
  // };

  const content = (
    <>
      <Space vertical align="start">
        {properties
          .filter((e) => !e.hidden)
          .map((element: ObjectFieldTemplatePropertyType) => element.content)}
      </Space>
      {/* <DescriptionFieldTemplate
            id={descriptionId<T>(idSchema)}
            description={uiOptions.description || description!}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          /> */}
      {canExpand(schema, uiSchema, formData) && (
        <AddButton
          disabled={disabled || readonly}
          onClick={onAddClick(schema)}
          uiSchema={uiSchema}
          registry={registry}
        />
      )}
    </>
  );

  return (
    <Space vertical align="start" className="Y-ObjectField">
      <TitleFieldTemplate
        id={titleId<T>(idSchema)}
        title={uiOptions.title || title}
        required={required}
        schema={schema}
        uiSchema={uiSchema}
        registry={registry}
      />
      {content}
    </Space>
  );
}
