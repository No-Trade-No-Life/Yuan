/**
 * Use an application parameter (string)
 *
 * @param key - The key of the parameter
 * @param defaultValue - The default value of the parameter
 * @returns The value of the parameter
 */
export const useParamString = (key: string, defaultValue = ''): string =>
  useParamSchema(key, { type: 'string', default: defaultValue });
