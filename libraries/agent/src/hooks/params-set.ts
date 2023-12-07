import { JSONSchema7 } from 'json-schema';
import { useAgent, useEffect } from './basic-set';

/**
 * Use parameter defined by JSON Schema
 *
 * @param key - Parameter name
 * @param schema - JSON Schema (https://json-schema.org/)
 * @returns Parameter value
 * @public
 */
export const useParamSchema = <T>(key: string, schema: JSONSchema7): T => {
  const agent = useAgent();

  useEffect(() => {
    agent.paramsSchema.properties![key] = schema;
  }, []);

  return agent.params[key] ?? schema.default;
};
/**
 * 使用参数 (string)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamString = (key: string, defaultValue = ''): string =>
  useParamSchema(key, { type: 'string', default: defaultValue });

/**
 * 使用参数 (number)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamNumber = (key: string, defaultValue = 0): number =>
  useParamSchema(key, { type: 'number', default: defaultValue });

/**
 * 使用参数 (boolean)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamBoolean = (key: string, defaultValue = false): boolean =>
  useParamSchema(key, { type: 'boolean', default: defaultValue });
