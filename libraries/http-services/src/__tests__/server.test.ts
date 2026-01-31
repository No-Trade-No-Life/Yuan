import { Terminal, GlobalPrometheusRegistry } from '@yuants/protocol';
import { provideHTTPProxyService } from '../server';
import { IHTTPProxyRequest } from '../types';
import { Subject, BehaviorSubject } from 'rxjs';

// Mock fetch
global.fetch = jest.fn();

// Mock metrics
const createMockMetric = () => {
  const metric = {
    inc: jest.fn(),
    dec: jest.fn(),
    set: jest.fn(),
    add: jest.fn(),
    observe: jest.fn(),
    labels: jest.fn().mockReturnThis(),
  };
  return metric;
};

describe('provideHTTPProxyService', () => {
  let terminal: Terminal;
  let mockMetrics: {
    counter: jest.SpyInstance;
    histogram: jest.SpyInstance;
    gauge: jest.SpyInstance;
  };

  beforeEach(() => {
    // Mock connection to prevent real WebSocket connection
    const output$ = new Subject<any>();
    const input$ = new Subject<any>();
    const isConnected$ = new BehaviorSubject<boolean>(true);
    const connection = {
      output$,
      input$,
      isConnected$,
      connectionId$: new BehaviorSubject('mock-conn-id'),
      connection$: new Subject(),
    };

    terminal = new Terminal(
      'ws://localhost:8888',
      {
        terminal_id: 'test-server',
      },
      {
        connection: connection as any,
      },
    );

    // Setup mock metrics
    mockMetrics = {
      counter: jest
        .spyOn(GlobalPrometheusRegistry, 'counter')
        .mockImplementation(() => createMockMetric() as any),
      histogram: jest
        .spyOn(GlobalPrometheusRegistry, 'histogram')
        .mockImplementation(() => createMockMetric() as any),
      gauge: jest
        .spyOn(GlobalPrometheusRegistry, 'gauge')
        .mockImplementation(() => createMockMetric() as any),
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    terminal.dispose();
    jest.restoreAllMocks();
  });

  it('should register HTTPProxy service with correct JSON Schema', () => {
    const spy = jest.spyOn(terminal.server, 'provideService');

    provideHTTPProxyService(terminal, { region: 'us-west', tier: 'premium' });

    expect(spy).toHaveBeenCalledWith(
      'HTTPProxy',
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          labels: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              region: { const: 'us-west' },
              tier: { const: 'premium' },
            }),
          }),
        }),
      }),
      expect.any(Function),
      {}, // Expect empty object instead of undefined because of destructuring default
    );
  });

  it('should not mark labels as required in Schema (allowing partial matching)', () => {
    const spy = jest.spyOn(terminal.server, 'provideService');

    provideHTTPProxyService(terminal, { region: 'us-west' });

    const callArgs = spy.mock.calls[0];
    const schema = callArgs[1] as any;
    const labelsSchema = schema.properties.labels;

    expect(labelsSchema.required).toBeUndefined();
  });

  it('should inject labels into terminal.terminalInfo.tags', () => {
    const labels = { region: 'us-west', ip: '1.2.3.4' };

    provideHTTPProxyService(terminal, labels);

    expect(terminal.terminalInfo.tags).toMatchObject(labels);
  });

  it('should initialize metrics correctly', () => {
    provideHTTPProxyService(terminal, {});

    // R6: Verify counter is initialized for requests_total
    expect(mockMetrics.counter).toHaveBeenCalledWith(
      'http_proxy_requests_total',
      'Total HTTP proxy requests',
    );

    // R7: Verify histogram is initialized with correct buckets
    expect(mockMetrics.histogram).toHaveBeenCalledWith(
      'http_proxy_request_duration_seconds',
      'HTTP proxy request duration in seconds',
      [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    );

    // R8: Verify gauge is initialized
    expect(mockMetrics.gauge).toHaveBeenCalledWith(
      'http_proxy_active_requests',
      'Number of active HTTP proxy requests',
    );

    // R9: Verify error counter is initialized
    expect(mockMetrics.counter).toHaveBeenCalledWith(
      'http_proxy_errors_total',
      'Total HTTP proxy errors by type',
    );
  });

  it('should record metrics for successful GET request (R6, R7, R8)', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      url: 'https://api.example.com/data',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"result":"success"}',
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
      method: 'GET',
    };

    await capturedHandler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-1',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    // R8: activeRequests.inc() should be called
    const gaugeMetric = mockMetrics.gauge.mock.results[0].value;
    expect(gaugeMetric.inc).toHaveBeenCalled();
    expect(gaugeMetric.dec).toHaveBeenCalled();

    // R6: requestsTotal.inc() should be called with correct labels
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '200',
      error_code: 'none',
    });
    expect(requestsTotalCounter.inc).toHaveBeenCalled();

    // R7: requestDuration.observe() should be called
    const durationHistogram = mockMetrics.histogram.mock.results[0].value;
    expect(durationHistogram.labels).toHaveBeenCalledWith({ method: 'GET' });
    expect(durationHistogram.observe).toHaveBeenCalled();
    expect(durationHistogram.observe).toHaveBeenCalledWith(expect.any(Number));

    dispose();
  });

  it('should record metrics for POST request (R6, R7, R8)', async () => {
    const mockResponse = {
      status: 201,
      statusText: 'Created',
      ok: true,
      url: 'https://api.example.com/data',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
      method: 'POST',
      body: '{"key":"value"}',
    };

    await capturedHandler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-2',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    // R6: requestsTotal.inc() should be called with POST method
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'POST',
      status_code: '201',
      error_code: 'none',
    });

    // R7: requestDuration.observe() should be called with POST method
    const durationHistogram = mockMetrics.histogram.mock.results[0].value;
    expect(durationHistogram.labels).toHaveBeenCalledWith({ method: 'POST' });

    dispose();
  });

  it('should record metrics for timeout error (R6, R7, R8, R9)', async () => {
    // Mock AbortError
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/slow',
      timeout: 100,
    };

    await expect(
      capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-3',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('TIMEOUT');

    // R8: activeRequests.inc() and dec() should both be called
    const gaugeMetric = mockMetrics.gauge.mock.results[0].value;
    expect(gaugeMetric.inc).toHaveBeenCalled();
    expect(gaugeMetric.dec).toHaveBeenCalled();

    // R6: requestsTotal.inc() should be called with error_code 'TIMEOUT'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '0',
      error_code: 'TIMEOUT',
    });
    expect(requestsTotalCounter.inc).toHaveBeenCalled();

    // R7: requestDuration.observe() should be called even for errors
    const durationHistogram = mockMetrics.histogram.mock.results[0].value;
    expect(durationHistogram.observe).toHaveBeenCalled();

    // R9: errorsTotal.inc() should be called with error_type 'timeout'
    const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
    expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'timeout' });
    expect(errorsTotalCounter.inc).toHaveBeenCalled();

    dispose();
  });

  it('should record metrics for network error (R6, R7, R8, R9)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/error',
    };

    await expect(
      capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-4',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('FETCH_FAILED');

    // R6: requestsTotal.inc() should be called with error_code 'FETCH_FAILED'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '0',
      error_code: 'FETCH_FAILED',
    });

    // R9: errorsTotal.inc() should be called with error_type 'network'
    const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
    expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'network' });
    expect(errorsTotalCounter.inc).toHaveBeenCalled();

    dispose();
  });

  it('should record metrics for FORBIDDEN error (R6, R7, R8, R9)', async () => {
    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {} as Record<string, string>, {
      allowedHosts: ['allowed.example.com'],
    });

    const request: IHTTPProxyRequest = {
      url: 'https://forbidden.example.com/data',
    };

    await expect(
      capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-5',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('FORBIDDEN');

    // R6: requestsTotal.inc() should be called with error_code 'FORBIDDEN'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '0',
      error_code: 'FORBIDDEN',
    });

    // R9: errorsTotal.inc() should be called with error_type 'security'
    const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
    expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'security' });
    expect(errorsTotalCounter.inc).toHaveBeenCalled();

    dispose();
  });

  it('should record metrics for INVALID_URL error (R6, R7, R8, R9)', async () => {
    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'not-a-valid-url',
    };

    await expect(
      capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-6',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('INVALID_URL');

    // R6: requestsTotal.inc() should be called with error_code 'INVALID_URL'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '0',
      error_code: 'INVALID_URL',
    });

    // R9: errorsTotal.inc() should be called with error_type 'validation'
    const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
    expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'validation' });

    dispose();
  });

  it('should record metrics for RESPONSE_TOO_LARGE error (R6, R7, R8, R9)', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      url: 'https://api.example.com/data',
      headers: new Headers({ 'content-length': '10485761' }), // 10MB + 1 byte
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: new Uint8Array(10485761) }),
          releaseLock: () => {},
        }),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {} as Record<string, string>, {
      maxResponseBodySize: 10 * 1024 * 1024,
    });

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
    };

    await expect(
      capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-7',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('RESPONSE_TOO_LARGE');

    // R6: requestsTotal.inc() should be called with error_code 'RESPONSE_TOO_LARGE'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '0',
      error_code: 'RESPONSE_TOO_LARGE',
    });

    // R9: errorsTotal.inc() should be called with error_type 'security'
    const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
    expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'security' });
    expect(errorsTotalCounter.inc).toHaveBeenCalled();

    dispose();
  });

  it('should always decrement activeRequests even when request throws (R8)', async () => {
    // Mock AbortError for timeout
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/slow',
      timeout: 100,
    };

    // Capture the gauge metric before the call
    const gaugeMetric = mockMetrics.gauge.mock.results[0].value;
    const incCallsBefore = gaugeMetric.inc.mock.calls.length;
    const decCallsBefore = gaugeMetric.dec.mock.calls.length;

    try {
      await capturedHandler(
        {
          req: request,
          source_terminal_id: 'client',
          target_terminal_id: 'test-server',
          trace_id: 'trace-8',
          seq_id: 0,
        },
        { isAborted$: undefined },
      );
    } catch (e) {
      // Expected to throw
    }

    // R8: activeRequests.inc() should be called at least once
    expect(gaugeMetric.inc).toHaveBeenCalled();

    // R8: activeRequests.dec() should be called even after error (finally block)
    expect(gaugeMetric.dec).toHaveBeenCalled();

    dispose();
  });

  it('should use default method GET when method is undefined (R6)', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      url: 'https://api.example.com/data',
      headers: new Headers({}),
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    let capturedHandler: any;
    jest.spyOn(terminal.server, 'provideService').mockImplementation((method, schema, handler) => {
      capturedHandler = handler;
      return { dispose: jest.fn() };
    });

    const { dispose } = provideHTTPProxyService(terminal, {});

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
      // method is undefined
    };

    await capturedHandler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-9',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    // R6: requestsTotal.inc() should use default method 'GET'
    const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
    expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
      method: 'GET',
      status_code: '200',
      error_code: 'none',
    });

    // R7: requestDuration.observe() should use default method 'GET'
    const durationHistogram = mockMetrics.histogram.mock.results[0].value;
    expect(durationHistogram.labels).toHaveBeenCalledWith({ method: 'GET' });

    dispose();
  });
});
