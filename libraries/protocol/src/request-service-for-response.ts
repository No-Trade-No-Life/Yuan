import { IResponse } from './model';

/**
 * Credential for host /request invocation.
 *
 * @public
 */
export interface IRequestServiceCredential {
  host_url: string;
  [k: string]: unknown;
}

/**
 * Request envelope for host /request invocation.
 *
 * @public
 */
export interface IRequestServiceReq<TReq = unknown> {
  method: string;
  req: TReq;
}

type RequestServiceErrorCode = 'INVALID_ARGUMENT' | 'HTTP_ERROR' | 'PROTOCOL_PARSE_ERROR' | 'NETWORK_ERROR';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const NO_RESPONSE: IResponse = {
  code: 'NO_RESPONSE',
  message: 'No Response Received',
};

const makeRequestServiceError = <T extends Record<string, unknown>>(
  code: RequestServiceErrorCode,
  message: string,
  details?: T,
) => Object.assign(new Error(message), { code, ...details });

const toSafeHostLabel = (url: URL) => `${url.protocol}//${url.host}`;

const validateHostURL = (hostURL: unknown): URL => {
  if (typeof hostURL !== 'string' || hostURL.trim() === '') {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'credential.host_url is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(hostURL);
  } catch {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'credential.host_url must be a valid URL');
  }

  return parsed;
};

const normalizeRequestURL = (hostURL: URL): URL => {
  let requestProtocol: 'http:' | 'https:';
  if (hostURL.protocol === 'https:' || hostURL.protocol === 'wss:') {
    requestProtocol = 'https:';
  } else if (hostURL.protocol === 'http:' || hostURL.protocol === 'ws:') {
    requestProtocol = 'http:';
  } else {
    throw makeRequestServiceError(
      'INVALID_ARGUMENT',
      'credential.host_url protocol must be http/https/ws/wss',
    );
  }

  if (requestProtocol === 'http:' && !LOOPBACK_HOSTS.has(hostURL.hostname)) {
    throw makeRequestServiceError(
      'INVALID_ARGUMENT',
      'credential.host_url must use https/wss (http/ws only allowed for localhost/127.0.0.1/::1)',
    );
  }

  const basePath = hostURL.pathname.replace(/\/+$/, '');
  const requestPath = basePath === '' ? '/request' : `${basePath}/request`;
  const requestURL = new URL(requestPath, hostURL);
  requestURL.protocol = requestProtocol;
  requestURL.search = hostURL.search;
  return requestURL;
};

const validateRequestEnvelope = (request: unknown): IRequestServiceReq => {
  if (!request || typeof request !== 'object') {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'req must be an object with method and req');
  }

  const input = request as Partial<IRequestServiceReq>;

  if (typeof input.method !== 'string' || input.method.trim() === '') {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'req.method is required');
  }

  if (!Object.prototype.hasOwnProperty.call(input, 'req')) {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'req.req is required');
  }

  if (input.req === undefined) {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'req.req cannot be undefined');
  }

  return input as IRequestServiceReq;
};

const parseNDJSONForResponse = <TRes>(rawText: string): IResponse<TRes> => {
  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      continue;
    }

    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      throw makeRequestServiceError('PROTOCOL_PARSE_ERROR', 'Failed to parse NDJSON response line', {
        line: i + 1,
      });
    }

    if (message && typeof message === 'object' && 'res' in message) {
      return (message as { res: IResponse<TRes> }).res;
    }
  }

  return NO_RESPONSE as IResponse<TRes>;
};

const readResponseTextWithLimit = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) {
    return '';
  }
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw makeRequestServiceError('HTTP_ERROR', 'Response body too large', {
        contentLength,
        maxBytes,
      });
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw makeRequestServiceError('HTTP_ERROR', 'Response body too large', {
        maxBytes,
      });
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
};

/**
 * Call host /request and return first response item.
 *
 * @public
 */
export const requestServiceForResponse = async <TReq = unknown, TRes = void>(
  credential: IRequestServiceCredential,
  req: IRequestServiceReq<TReq>,
): Promise<IResponse<TRes>> => {
  const hostURL = validateHostURL(credential?.host_url);
  const requestURL = normalizeRequestURL(hostURL);
  const safeHostLabel = toSafeHostLabel(requestURL);
  const request = validateRequestEnvelope(req);

  let body: string;
  try {
    body = JSON.stringify({ method: request.method, req: request.req });
  } catch {
    throw makeRequestServiceError('INVALID_ARGUMENT', 'req is not JSON-serializable');
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(requestURL, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch (error) {
    throw makeRequestServiceError('NETWORK_ERROR', 'Failed to call host /request', {
      method: request.method,
      host: safeHostLabel,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw makeRequestServiceError('HTTP_ERROR', `HTTP ${response.status} ${response.statusText}`.trim(), {
      status: response.status,
      statusText: response.statusText,
      method: request.method,
      host: safeHostLabel,
    });
  }

  const text = await readResponseTextWithLimit(response, DEFAULT_MAX_RESPONSE_BYTES);
  return parseNDJSONForResponse<TRes>(text);
};
