import { Terminal } from '@yuants/protocol';
import { requestHTTPProxy } from '../client';
import { IHTTPProxyRequest } from '../types';
import { Subject, BehaviorSubject } from 'rxjs';

describe('requestHTTPProxy', () => {
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
        terminal_id: 'test-client',
      },
      {
        connection: connection as any,
      },
    );
  });

  afterEach(() => {
    terminal.dispose();
  });

  it('should call terminal.client.requestForResponse with correct arguments', async () => {
    const mockResponse = {
      code: 0,
      message: 'OK',
      data: {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
        ok: true,
        url: 'https://api.example.com/data',
      },
    };

    jest.spyOn(terminal.client, 'requestForResponse').mockResolvedValue(mockResponse);

    const request: IHTTPProxyRequest = {
      url: 'https://api.example.com/data',
      labels: { region: 'us-west' },
    };

    const response = await requestHTTPProxy(terminal, request);

    expect(terminal.client.requestForResponse).toHaveBeenCalledWith('HTTPProxy', request);
    expect(response).toEqual(mockResponse);
  });
});
