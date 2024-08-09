import { UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `PrometheusClient/${UUID()}`,
  name: `@yuants/app-prometheus-client`,
});
