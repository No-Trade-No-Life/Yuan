/**
 * Use an application parameter (boolean)
 *
 * @param key - The key of the parameter
 * @param defaultValue - The default value of the parameter
 * @returns The value of the parameter
 */
export const useParamBoolean = (key: string, defaultValue = false): boolean =>
  useParamSchema(key, { type: 'boolean', default: defaultValue });
