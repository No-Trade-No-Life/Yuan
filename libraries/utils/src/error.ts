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
export function newError(type: string, context: Record<string, any>) {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(', ');
  errorCounter.labels({ type }).inc();
  return new Error(`${type}: ${contextStr}`);
}
