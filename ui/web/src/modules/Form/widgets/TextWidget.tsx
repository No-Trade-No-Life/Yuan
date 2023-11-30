import { Checkbox, Input, InputNumber, Radio, RadioGroup } from '@douyinfe/semi-ui';
import { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import { OHLCSelectWidget } from './OHLCSelectWidget';

export function TextWidget<T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: WidgetProps<T, S, F>,
) {
  if (props.schema.format === 'OHLC-key') {
    return <OHLCSelectWidget {...props} />;
  }

  // For CopilotForm
  if (props.schema.type === 'string' && Array.isArray(props.schema.examples)) {
    return (
      <>
        {props.schema.examples.map((item) => (
          <Checkbox
            checked={props.value === item?.toString()}
            onChange={(e) => {
              if (e.target.checked) {
                props.onChange(item?.toString());
              }
            }}
          >
            {item?.toString()}
          </Checkbox>
        ))}
        <Checkbox
          checked={!props.schema.examples.includes(props.value)}
          onChange={(e) => {
            if (e.target.checked) {
              props.onChange('');
            }
          }}
        >
          Other
        </Checkbox>
        <Input
          type="text"
          className="YTextWidget"
          style={{ minWidth: 120 }}
          list={props.schema.examples ? props.id + '__examples' : undefined}
          value={props.value}
          required={props.required}
          onChange={(v) => props.onChange(v)}
        />
      </>
    );
  }

  return (
    <>
      {props.schema.type === 'number' ? (
        <InputNumber
          style={{ minWidth: 120 }}
          list={props.schema.examples ? props.id + '__examples' : undefined}
          value={props.value}
          required={props.required}
          onChange={(v) => props.onChange(v)}
        />
      ) : (
        <Input
          type="text"
          className="YTextWidget"
          style={{ minWidth: 120 }}
          list={props.schema.examples ? props.id + '__examples' : undefined}
          value={props.value}
          required={props.required}
          onChange={(v) => props.onChange(v)}
        />
      )}

      {props.schema.examples && (
        <datalist id={props.id + '__examples'}>
          {(props.schema.examples as string[]).map((v, i) => (
            // @ts-expect-error
            <option key={v} value={v} label={props.schema.exampleNames?.[i]} />
          ))}
        </datalist>
      )}
    </>
  );
}
