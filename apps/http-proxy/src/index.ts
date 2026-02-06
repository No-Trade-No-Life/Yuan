import { computeAndInjectProxyIp, provideHTTPProxyService } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { fromEvent, merge, take, tap } from 'rxjs';

(async () => {
  const HOSTNAME = process.env.HOSTNAME || (await import('os')).hostname();

  const CONCURRENT = process.env.CONCURRENT ? Number(process.env.CONCURRENT) : 1000;
  const INGRESS_TOKEN_CAPACITY = process.env.INGRESS_TOKEN_CAPACITY
    ? Number(process.env.INGRESS_TOKEN_CAPACITY)
    : 1000;

  const terminal = Terminal.fromNodeEnv();
  await computeAndInjectProxyIp(terminal, { proxyIp: process.env.PROXY_IP });

  const labels: Record<string, string> = {};
  const ip = terminal.terminalInfo.tags?.ip;
  const ipSource = terminal.terminalInfo.tags?.ip_source;
  if (ip && ipSource === 'http-services') {
    labels.ip = ip;
  } else if (ip) {
    console.info(formatTime(Date.now()), '[http-proxy] ip tag source not trusted, skip labels.ip');
  }
  labels.hostname = HOSTNAME;
  console.info(formatTime(Date.now()), '[http-proxy] labels:', labels);
  const options = {
    concurrent: CONCURRENT,
    ingress_token_capacity: INGRESS_TOKEN_CAPACITY,
  };

  const { dispose } = provideHTTPProxyService(terminal, labels, options);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.info(formatTime(Date.now()), `[http-proxy] received ${signal}, shutting down`);
    try {
      dispose();
      terminal.dispose();
      process.exit(0);
    } catch (err) {
      console.error(formatTime(Date.now()), '[http-proxy] shutdown failed', err);
      process.exit(1);
    }
  };
  const shutdown$ = merge(fromEvent(process, 'SIGINT'), fromEvent(process, 'SIGTERM')).pipe(
    take(1),
    tap((signal) => {
      console.info(formatTime(Date.now()), `[http-proxy] received ${signal}, shutting down`);
    }),
  );

  shutdown$.subscribe((signal) => {
    shutdown(signal as NodeJS.Signals);
  });
})();
