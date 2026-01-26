import { Terminal } from '@yuants/protocol';
import { provideHTTPProxyService } from '../server';
import { IHTTPProxyRequest } from '../types';
import { Subject, BehaviorSubject } from 'rxjs';

// Mock fetch
global.fetch = jest.fn();

describe('provideHTTPProxyService', () => {
  let terminal: Terminal;

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
    jest.clearAllMocks();
  });

  afterEach(() => {
    terminal.dispose();
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

  it('should successfully handle GET request', async () => {
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

    // Capture the handler
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

    const result = await capturedHandler(
      {
        req: request,
        source_terminal_id: 'client',
        target_terminal_id: 'test-server',
        trace_id: 'trace-1',
        seq_id: 0,
      },
      { isAborted$: undefined },
    );

    expect(result.res.code).toBe(0);
    expect(result.res.data.status).toBe(200);
    expect(result.res.data.body).toBe('');

    dispose();
  });

  it('should handle timeout error', async () => {
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
          trace_id: 'trace-2',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('TIMEOUT');

    dispose();
  });

  it('should handle network error', async () => {
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
          trace_id: 'trace-3',
          seq_id: 0,
        },
        { isAborted$: undefined },
      ),
    ).rejects.toThrow('FETCH_FAILED');

    dispose();
  });
});
