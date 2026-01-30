import { fetch } from '@yuants/http-services';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { encodeHex, formatTime, HmacSHA256, newError, tokenBucket } from '@yuants/utils';

const MetricBinanceApiUsedWeight = GlobalPrometheusRegistry.gauge('binance_api_used_weight', '');
const MetricBinanceApiCounter = GlobalPrometheusRegistry.counter('binance_api_request_total', '');
const terminal = Terminal.fromNodeEnv();
const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

type RequestParams = Record<string, string | number | boolean | undefined>;

export interface ICredential {
  access_key: string;
  secret_key: string;
}

export interface IApiError {
  code: number;
  msg: string;
}

export const spotAPIBucket = tokenBucket('api.binance.com', {
  capacity: 6000,
  refillInterval: 60_000,
  refillAmount: 6000,
});

export const futureAPIBucket = tokenBucket('fapi.binance.com', {
  capacity: 2400,
  refillInterval: 60_000,
  refillAmount: 2400,
});

export const unifiedAPIBucket = tokenBucket('papi.binance.com', {
  capacity: 6000,
  refillInterval: 60_000,
  refillAmount: 6000,
});

export const unifiedOrderAPIBucket = tokenBucket('order/unified/minute', {
  capacity: 1200,
  refillInterval: 60_000,
  refillAmount: 1200,
});

// 每个接口单独进行主动限流控制
const mapPathToRetryAfterUntil: Record<string, number> = {};

export const isApiError = <T>(value: T | IApiError): value is IApiError =>
  typeof (value as IApiError)?.code === 'number' && typeof (value as IApiError)?.msg === 'string';

const appendParams = (url: URL, params?: RequestParams) => {
  if (!params) return;
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  const timestampEntry = entries.find(([key]) => key === 'timestamp');
  const restEntries = entries.filter(([key]) => key !== 'timestamp');
  restEntries
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  if (timestampEntry) {
    url.searchParams.set(timestampEntry[0], String(timestampEntry[1]));
  }
};

const callApi = async <T>(
  method: HttpMethod,
  endpoint: string,
  params?: RequestParams,
  credential?: ICredential,
): Promise<T> => {
  const url = new URL(endpoint);
  const normalizedParams: RequestParams = { ...params };
  if (credential) {
    if (normalizedParams.recvWindow === undefined) {
      // FYI https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info#timing-security
      normalizedParams.recvWindow = 5000;
    }
    if (normalizedParams.timestamp === undefined) {
      normalizedParams.timestamp = Date.now();
    }
  }
  appendParams(url, normalizedParams);

  let headers: Record<string, string> | undefined;
  if (credential) {
    const signData = url.search.slice(1);

    const signature = encodeHex(
      await HmacSHA256(new TextEncoder().encode(signData), new TextEncoder().encode(credential.secret_key)),
    );
    url.searchParams.set('signature', signature);
    headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'X-MBX-APIKEY': credential.access_key,
    };
    console.info(formatTime(Date.now()), 'request', method, url.host, url.pathname);
  } else {
    console.info(formatTime(Date.now()), 'request', method, url.host, url.pathname);
  }

  const retryAfterUntil = mapPathToRetryAfterUntil[endpoint];

  if (retryAfterUntil) {
    if (Date.now() <= retryAfterUntil) {
      // 主动限流
      throw newError('ACTIVE_RATE_LIMIT', {
        wait_time: `${retryAfterUntil - Date.now()}ms`,
        retryAfterUntil,
        url: `${url.host}${url.pathname}`,
      });
    }
    delete mapPathToRetryAfterUntil[endpoint];
  }

  MetricBinanceApiCounter.labels({ path: url.pathname, terminal_id: terminal.terminal_id }).inc();

  const res = await fetchImpl(url.href, {
    method,
    headers,
  });
  const usedWeight1M = res.headers.get('x-mbx-used-weight-1m');
  const retryAfter = res.headers.get('Retry-After');
  if (retryAfter) {
    mapPathToRetryAfterUntil[endpoint] = Date.now() + parseInt(retryAfter, 10) * 1000;
  }
  console.info(
    formatTime(Date.now()),
    'response',
    method,
    url.host,
    url.pathname,
    `status=${res.status}`,
    retryAfter ? `retryAfter=${retryAfter}` : '',
    `usedWeight1M=${usedWeight1M ?? 'N/A'}`,
  );
  if (usedWeight1M) {
    MetricBinanceApiUsedWeight.labels({ path: endpoint, terminal_id: terminal.terminal_id }).set(
      +usedWeight1M,
    );
  }
  return res.json() as Promise<T>;
};

export const requestPublic = <T>(method: HttpMethod, endpoint: string, params?: RequestParams) =>
  callApi<T>(method, endpoint, params);

export const requestPrivate = <T>(
  credential: ICredential,
  method: HttpMethod,
  endpoint: string,
  params?: RequestParams,
) => callApi<T>(method, endpoint, params, credential);

export const getDefaultCredential = (): ICredential => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    throw new Error('Missing Binance credential: ACCESS_KEY and SECRET_KEY must be set');
  }
  return { access_key, secret_key };
};
