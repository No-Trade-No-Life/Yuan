import { Modal } from '@douyinfe/semi-ui';
import { ModalReactProps } from '@douyinfe/semi-ui/lib/es/modal';
import { FormProps, ThemeProps, withTheme } from '@rjsf/core';
import { FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import React, { ComponentType, createElement } from 'react';
import Templates, { generateTemplates } from './templates';
import Widgets, { generateWidgets } from './widgets';

export function generateTheme<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(): ThemeProps<T, S, F> {
  return {
    templates: generateTemplates<T, S, F>(),
    widgets: generateWidgets<T, S, F>(),
  };
}

const Theme = generateTheme();

export function generateForm<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(): ComponentType<FormProps<T, S, F>> {
  return withTheme<T, S, F>(generateTheme<T, S, F>());
}

const _Form = generateForm();

export const Form = (props: Omit<FormProps<any, any, any>, 'validator'>) =>
  createElement(_Form, { ...props, validator });

export { Templates, Theme, Widgets, generateTemplates, generateWidgets };

export default Form;

export const showForm = <T>(schema: JSONSchema7, initialData?: any) => {
  return new Promise<T>((resolve, reject) => {
    let data = initialData;
    let modal: ReturnType<typeof Modal.info> | undefined;
    function getProps(): ModalReactProps {
      return {
        content: React.createElement(
          Form,
          {
            schema,
            formData: data,
            onChange: (e) => {
              data = e.formData;
              modal?.update(getProps());
            },
          },
          React.createElement('div'),
        ),
        onCancel: () => {
          reject(new Error('User Cancelled'));
        },
        onOk: () => {
          resolve(data);
        },
        okText: t('common:submit'),
        cancelText: t('common:cancel'),
      };
    }
    modal = Modal.info(getProps());
  });
};
