import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Card, List, Space } from '@douyinfe/semi-ui';
import { ErrorListProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';

/** The `ErrorList` component is the template that renders the all the errors associated with the fields in the `Form`
 *
 * @param props - The `ErrorListProps` for this component
 */
export default function ErrorList<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({ errors }: ErrorListProps<T, S, F>) {
  return (
    <Card>
      <List className="list-group" size="small">
        {errors.map((error, index) => (
          <List.Item key={index}>
            <Space>
              <IconInfoCircle />
              {error.stack}
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );
}
