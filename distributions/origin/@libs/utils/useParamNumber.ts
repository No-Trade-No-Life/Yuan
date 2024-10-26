/**
 * Use an application parameter (number)
 *
 * @param key - The key of the parameter
 * @param defaultValue - The default value of the parameter
 * @returns The value of the parameter
 */
export const useParamNumber = (key: string, defaultValue = 0): number =>
  useParamSchema(key, { type: 'number', default: defaultValue });
