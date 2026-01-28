import { provideHTTPProxyService } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { fromEvent, merge, take, tap } from 'rxjs';

(async () => {
  const PROXY_IP =
    process.env.PROXY_IP ||
    (await fetch('http://ifconfig.me/ip')
      .then((res) => res.text())
      .catch((e) => {
        console.info(formatTime(Date.now()), '[http-proxy] failed to fetch public IP address:', e);
        return '';
      }));

  const HOSTNAME = process.env.HOSTNAME || (await import('os')).hostname();

  const CONCURRENT = process.env.CONCURRENT ? Number(process.env.CONCURRENT) : 10;
  const INGRESS_TOKEN_CAPACITY = process.env.INGRESS_TOKEN_CAPACITY
    ? Number(process.env.INGRESS_TOKEN_CAPACITY)
    : 100;

  const labels: Record<string, string> = {};
  labels.ip = PROXY_IP;
  labels.hostname = HOSTNAME;
  console.info(formatTime(Date.now()), '[http-proxy] labels:', labels);

  const terminal = Terminal.fromNodeEnv();
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
