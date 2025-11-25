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
  errorCounter.labels({ type }).inc();
  const contextStr = Object.entries(context)
    .map(([key, value]) => {
      try {
        return `${key}=${JSON.stringify(value)}`;
      } catch (e) {
        return `${key}=<SerializationError>`;
      }
    })
    .join(', ');
  // 使用 cause 传递原始错误信息 (ES2022)
  return new Error(`${type}: ${contextStr}`, { cause: originalError } as ErrorOptions);
}

/**
 * Execute a function within an error scope.
 * Any error thrown will be wrapped with the provided type and context.
 *
 * @public
 * @param type - Error type
 * @param context - Error context or a function that returns the context
 * @param staff - Function to execute
 * @returns Result of the function
 */
export function scopeError<T>(
  type: string,
  context: Record<string, any> | (() => Record<string, any>),
  staff: () => T,
): T {
  try {
    const result = staff();
    if (result instanceof Promise) {
      return result.catch((e) => {
        const ctx = typeof context === 'function' ? context() : context;
        throw newError(type, ctx, e);
      }) as any;
    }
    return result;
  } catch (e) {
    const ctx = typeof context === 'function' ? context() : context;
    throw newError(type, ctx, e);
  }
}
