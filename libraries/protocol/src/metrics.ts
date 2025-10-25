import { createRegistry } from '@yuants/prometheus';
import { Registry } from '@yuants/prometheus-client';

/**
 * Prometheus Metrics Registry
 *
 * @deprecated - use terminal.metrics or GlobalPrometheusRegistry instead
 *
 * @public
 */
export const PromRegistry = new Registry();

/**
 * Global Prometheus Metrics Registry
 * @public
 */
export const GlobalPrometheusRegistry = createRegistry();
