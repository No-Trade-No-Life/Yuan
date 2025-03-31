import { Modal, Toast } from '@douyinfe/semi-ui';
import { ModalReactProps } from '@douyinfe/semi-ui/lib/es/modal';
import { FormProps, ThemeProps, withTheme } from '@rjsf/core';
import { FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import Ajv from 'ajv';
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

/**
 * Request user to input data according to the schema.
 * @param schema - JSON Schema (https://json-schema.org/)
 * @param initialData - Initial data to be filled in the form
 * @returns Promise of user input data
 */
export const showForm = <T>(
  schema: JSONSchema7,
  initialData?: any,
  options?: {
    /**
     * Whether to submit the form immediately if the initial data is valid.
     * if set to true, the form will be submitted immediately without showing the form.
     * if initial data is invalid, the form will be shown as usual.
     */
    immediateSubmit?: boolean;
  },
): Promise<T> => {
  // Open a confirm modal for boolean type
  if (schema.type === 'boolean') {
    if (options?.immediateSubmit) {
      if (typeof initialData === 'boolean') {
        return Promise.resolve<any>(initialData);
      }
    }
    return new Promise<any>((resolve, reject) => {
      // boolean form is usually used for confirmation
      // but for different situations, we need to use different okText and cancelText
      // for example, when we want to delete a file, we need to use 'Delete' and 'Cancel'.
      // but when we want to overwrite a file, we need to use 'Overwrite' and 'Cancel'.
      // the fallback is just 'Yes' and 'No'. Not so bad.

      Modal.confirm({
        title: schema.title,
        content: schema.description,
        getPopupContainer: () => document.getElementById('root') as HTMLElement,
        okText: t('common:yes'),
        cancelText: t('common:no'),
        onOk: () => {
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        },
      });
    });
  }

  return new Promise<T>((resolve, reject) => {
    if (options?.immediateSubmit) {
      const ajv = new Ajv({ strictSchema: false });
      if (ajv.validate(schema, initialData)) {
        resolve(initialData);
        return;
      }
      Toast.error(ajv.errorsText());
    }
    let data = initialData;
    let modal: ReturnType<typeof Modal.info> | undefined;
    function getProps(): ModalReactProps {
      return {
        getPopupContainer: () => document.getElementById('root') as HTMLElement,
        icon: null,
        bodyStyle: { maxHeight: '80vh', overflow: 'auto' },
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
          const ajv = new Ajv({ strictSchema: false });
          if (ajv.validate(schema, data)) {
            resolve(data);
            return;
          }
          Toast.error(ajv.errorsText());
          reject(new Error('Validation Failed'));
        },
        okText: t('common:submit'),
        cancelText: t('common:cancel'),
        style: { width: '80%', maxWidth: 800 },
      };
    }
    modal = Modal.info(getProps());
  });
};
