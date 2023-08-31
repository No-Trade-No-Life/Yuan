import React from 'react';
import {
  getSubmitButtonOptions,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  SubmitButtonProps,
} from '@rjsf/utils';
import { Button } from '@douyinfe/semi-ui';

/** The `SubmitButton` renders a button that represent the `Submit` action on a form
 */
export default function SubmitButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>({ uiSchema }: SubmitButtonProps<T, S, F>) {
  const { submitText, norender, props: submitButtonProps } = getSubmitButtonOptions(uiSchema);
  if (norender) {
    return null;
  }
  return (
    <Button {...submitButtonProps} htmlType="submit">
      {submitText}
    </Button>
  );
}
