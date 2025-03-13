import { FormContextType, RJSFSchema, StrictRJSFSchema, TemplatesType } from '@rjsf/utils';

import ArrayFieldItemTemplate from './ArrayFieldItemTemplate';
import ArrayFieldTemplate from './ArrayFieldTemplate';
import BaseInputTemplate from './BaseInputTemplate';
import { FieldTemplate } from './FieldTemplate';
import { AddButton, MoveDownButton, MoveUpButton, RemoveButton } from './IconButton';
import ObjectFieldTemplate from './ObjectFieldTemplate';
import SubmitButton from './SubmitButton';
import UnsupportedFieldTemplate from './UnsupportedFieldTemplate';
import WrapIfAdditionalTemplate from './WrapIfAdditionalTemplate';

export function generateTemplates<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(): Partial<TemplatesType<T, S, F>> {
  return {
    ArrayFieldItemTemplate,
    ArrayFieldTemplate,
    BaseInputTemplate,
    ButtonTemplates: {
      AddButton,
      MoveDownButton,
      MoveUpButton,
      RemoveButton,
      SubmitButton,
    },
    // DescriptionFieldTemplate: DescriptionField,
    // ErrorListTemplate: ErrorList,
    // FieldErrorTemplate,
    FieldTemplate,
    ObjectFieldTemplate,
    // TitleFieldTemplate: TitleField,
    UnsupportedFieldTemplate,
    WrapIfAdditionalTemplate,
  };
}

export default generateTemplates();
