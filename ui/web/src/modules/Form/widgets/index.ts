import { FormContextType, RegistryWidgetsType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import CheckboxWidget from './CheckboxWidget';
import DateTimeWidget from './DateTimeWidget';
import SelectWidget from './SelectWidget';
import { TextWidget } from './TextWidget';

export function generateWidgets<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(): RegistryWidgetsType<T, S, F> {
  return {
    // AltDateTimeWidget,
    // AltDateWidget,
    // CheckboxesWidget,
    CheckboxWidget,
    DateTimeWidget,
    // DateWidget,
    // PasswordWidget,
    // RadioWidget,
    // RangeWidget,
    TextWidget,
    SelectWidget,
    // TextareaWidget,
  };
}

export default generateWidgets();
