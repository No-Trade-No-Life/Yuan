import { Validator } from '@cfworker/json-schema';
import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';

export const createValidator = (schema: JSONSchema7): ((data: unknown) => boolean) => {
  try {
    // Test if Ajv can be used (i.e., environment allows unsafe-eval)
    new Function('return true;')();
    return new Ajv({ strict: false, strictSchema: false }).compile(schema);
  } catch (error) {
    // Fallback to cfworker/json-schema if unsafe-eval is not allowed
    const v = new Validator(schema as any, '2020-12');
    return (data: unknown): boolean => {
      const result = v.validate(data);
      return result.valid;
    };
  }
};
