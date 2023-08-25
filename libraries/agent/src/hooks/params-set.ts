import { IProduct } from '@yuants/protocol';
import { useAgent, useEffect } from './basic-set';
import { useProduct } from './useProduct';

/**
 * 使用参数 (string)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamString = (key: string, defaultValue = ''): string => {
  const agent = useAgent();

  useEffect(() => {
    agent.paramsSchema.properties![key] = { type: 'string', default: defaultValue };
  }, []);
  return agent.params[key] ?? defaultValue;
};

/**
 * 使用参数 (number)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamNumber = (key: string, defaultValue = 0): number => {
  const node = useAgent();
  useEffect(() => {
    node.paramsSchema.properties![key] = { type: 'number', default: defaultValue };
  }, []);
  return node.params[key] ?? defaultValue;
};

/**
 * 使用参数 (boolean)
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 参数值
 * @public
 */
export const useParamBoolean = (key: string, defaultValue = false): boolean => {
  const node = useAgent();
  useEffect(() => {
    node.paramsSchema.properties![key] = { type: 'boolean', default: defaultValue };
  }, []);
  return node.params[key] ?? defaultValue;
};
