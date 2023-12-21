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
