import { createRegistry } from '@yuants/prometheus';

/** @public */
export const errorRegistry = createRegistry();
const errorCounter = errorRegistry.counter('new_errors_total', 'Total number of errors');

/**
 * Create a new error with context information
 *
 * @public
 * @param type - Error type
 * @param context - Error context
 * @returns Error object
 */
export function newError(type: string, context: Record<string, any>, originalError?: unknown) {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(', ');
  errorCounter.labels({ type }).inc();
  // 使用 cause 传递原始错误信息 (ES2022)
  return new Error(`${type}: ${contextStr}`, { cause: originalError } as ErrorOptions);
}

/**
 * Wrap a function with error context
 *
 * @public
 * @param type - Error type
 * @param context - Error context
 * @param staff - Function to execute
 * @returns Result of the function
 */
export function withErrorContext<T>(type: string, context: Record<string, any>, staff: () => T): T {
  try {
    const result = staff();
    if (result instanceof Promise) {
      return result.catch((e) => {
        throw newError(type, context, e);
      }) as any;
    }
    return result;
  } catch (e) {
    throw newError(type, context, e);
  }
}
