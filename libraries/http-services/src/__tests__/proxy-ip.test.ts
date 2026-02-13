import { Terminal } from '@yuants/protocol';

jest.mock('@yuants/utils', () => {
  const actual = jest.requireActual('@yuants/utils');
  return {
    ...actual,
    tokenBucket: jest.fn(),
  };
});

import { acquireProxyBucket } from '../proxy-ip';
import { encodePath, tokenBucket } from '@yuants/utils';

const TRUSTED_PROXY_TERMINAL_IDS_ENV = 'TRUSTED_HTTP_PROXY_TERMINAL_IDS';

type MockBucket = {
  read: () => number;
  acquireSync: (tokens: number) => void;
};

const mockTokenBucket = tokenBucket as unknown as jest.Mock;

const originalTrustedProxyTerminalIds = process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV];

const createTerminal = (terminalId: string, ips: string[]): Terminal =>
  ({
    terminal_id: terminalId,
    terminalInfos: ips.map((ip, index) => ({
      terminal_id: `${terminalId}-proxy-${index + 1}`,
      tags: { ip, ip_source: 'http-services' },
      serviceInfo: {
        [`HTTPProxy-${index + 1}`]: {
          method: 'HTTPProxy',
          schema: { type: 'object' },
        },
      },
    })),
  } as unknown as Terminal);

const allowTerminalProxies = (terminal: Terminal): void => {
  const trustedTerminalIds = terminal.terminalInfos.map((info) => info.terminal_id).join(',');
  process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV] = trustedTerminalIds;
};

describe('acquireProxyBucket', () => {
  beforeEach(() => {
    mockTokenBucket.mockReset();
    delete process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV];
  });

  afterAll(() => {
    if (originalTrustedProxyTerminalIds === undefined) {
      delete process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV];
    } else {
      process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV] = originalTrustedProxyTerminalIds;
    }
  });

  it('should prioritize candidates with read() >= weight', () => {
    const terminal = createTerminal('terminal-priority', ['10.0.0.1', '10.0.0.2', '10.0.0.3']);
    allowTerminalProxies(terminal);
    const attempts: string[] = [];
    const bucketsByKey = new Map<string, MockBucket>([
      [
        encodePath(['priority-base', '10.0.0.1']),
        {
          read: () => 1,
          acquireSync: () => {
            attempts.push('10.0.0.1');
          },
        },
      ],
      [
        encodePath(['priority-base', '10.0.0.2']),
        {
          read: () => 20,
          acquireSync: () => {
            attempts.push('10.0.0.2');
          },
        },
      ],
      [
        encodePath(['priority-base', '10.0.0.3']),
        {
          read: () => 10,
          acquireSync: () => {
            attempts.push('10.0.0.3');
          },
        },
      ],
    ]);

    mockTokenBucket.mockImplementation((bucketKey: string) => {
      const bucket = bucketsByKey.get(bucketKey);
      if (!bucket) throw new Error(`Unexpected bucket key: ${bucketKey}`);
      return bucket;
    });

    const result = acquireProxyBucket({
      baseKey: 'priority-base',
      weight: 5,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });

    expect(result.ip).toBe('10.0.0.2');
    expect(attempts[0]).toBe('10.0.0.2');
    expect(attempts).toEqual(['10.0.0.2']);
  });

  it('should switch to next candidate when acquireSync fails', () => {
    const terminal = createTerminal('terminal-switch', ['10.0.1.1', '10.0.1.2']);
    allowTerminalProxies(terminal);
    const attempts: string[] = [];
    const bucketsByKey = new Map<string, MockBucket>([
      [
        encodePath(['switch-base', '10.0.1.1']),
        {
          read: () => 10,
          acquireSync: () => {
            attempts.push('10.0.1.1');
            throw new Error('SEMAPHORE_INSUFFICIENT_PERMS: no quota');
          },
        },
      ],
      [
        encodePath(['switch-base', '10.0.1.2']),
        {
          read: () => 10,
          acquireSync: () => {
            attempts.push('10.0.1.2');
          },
        },
      ],
    ]);

    mockTokenBucket.mockImplementation((bucketKey: string) => {
      const bucket = bucketsByKey.get(bucketKey);
      if (!bucket) throw new Error(`Unexpected bucket key: ${bucketKey}`);
      return bucket;
    });

    const result = acquireProxyBucket({
      baseKey: 'switch-base',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });

    expect(result.ip).toBe('10.0.1.2');
    expect(attempts).toEqual(['10.0.1.1', '10.0.1.2']);
  });

  it('should throw E_PROXY_TARGET_NOT_FOUND when pool is empty', () => {
    const terminal = createTerminal('terminal-empty', []);
    process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV] = 'terminal-empty-proxy-1';

    expect(() =>
      acquireProxyBucket({
        baseKey: 'empty-base',
        weight: 1,
        terminal,
        getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
      }),
    ).toThrow('E_PROXY_TARGET_NOT_FOUND');
  });

  it('should throw E_PROXY_BUCKET_EXHAUSTED when all candidates fail', () => {
    const terminal = createTerminal('terminal-exhausted', ['10.0.2.1', '10.0.2.2']);
    allowTerminalProxies(terminal);
    const bucketsByKey = new Map<string, MockBucket>([
      [
        encodePath(['exhausted-base', '10.0.2.1']),
        {
          read: () => 3,
          acquireSync: () => {
            throw new Error('SEMAPHORE_INSUFFICIENT_PERMS: no quota');
          },
        },
      ],
      [
        encodePath(['exhausted-base', '10.0.2.2']),
        {
          read: () => 3,
          acquireSync: () => {
            throw new Error('SEMAPHORE_INSUFFICIENT_PERMS: no quota');
          },
        },
      ],
    ]);

    mockTokenBucket.mockImplementation((bucketKey: string) => {
      const bucket = bucketsByKey.get(bucketKey);
      if (!bucket) throw new Error(`Unexpected bucket key: ${bucketKey}`);
      return bucket;
    });

    expect(() =>
      acquireProxyBucket({
        baseKey: 'exhausted-base',
        weight: 10,
        terminal,
        getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
      }),
    ).toThrow('E_PROXY_BUCKET_EXHAUSTED');
  });

  it('should throw E_BUCKET_OPTIONS_CONFLICT for same bucketKey options mismatch', () => {
    const terminal = createTerminal('terminal-conflict', ['10.0.3.1']);
    allowTerminalProxies(terminal);

    mockTokenBucket.mockImplementation(() => {
      return {
        read: () => 10,
        acquireSync: () => {},
      };
    });

    acquireProxyBucket({
      baseKey: 'conflict-base',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });

    expect(() =>
      acquireProxyBucket({
        baseKey: 'conflict-base',
        weight: 1,
        terminal,
        getBucketOptions: () => ({ capacity: 200, refillAmount: 200, refillInterval: 60_000 }),
      }),
    ).toThrow('E_BUCKET_OPTIONS_CONFLICT');
  });

  it('should maintain independent round robin cursor for different baseKey', () => {
    const terminal = createTerminal('terminal-r11', ['10.0.4.1', '10.0.4.2']);
    allowTerminalProxies(terminal);

    mockTokenBucket.mockImplementation(() => {
      return {
        read: () => 10,
        acquireSync: () => {},
      };
    });

    const keyA1 = acquireProxyBucket({
      baseKey: 'base-A',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });
    const keyB1 = acquireProxyBucket({
      baseKey: 'base-B',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });
    const keyA2 = acquireProxyBucket({
      baseKey: 'base-A',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });
    const keyB2 = acquireProxyBucket({
      baseKey: 'base-B',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });

    expect(keyA1.ip).toBe('10.0.4.1');
    expect(keyB1.ip).toBe('10.0.4.1');
    expect(keyA2.ip).toBe('10.0.4.2');
    expect(keyB2.ip).toBe('10.0.4.2');
  });

  it('should fail closed when trusted terminal allowlist is empty', () => {
    const terminal = createTerminal('terminal-allowlist-empty', ['10.0.5.1']);

    mockTokenBucket.mockImplementation(() => {
      return {
        read: () => 10,
        acquireSync: () => {},
      };
    });

    expect(() =>
      acquireProxyBucket({
        baseKey: 'allowlist-base',
        weight: 1,
        terminal,
        getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
      }),
    ).toThrow('E_PROXY_TARGET_NOT_FOUND');
  });

  it('should throw E_PROXY_ACQUIRE_INTERNAL_ERROR for unexpected acquire errors', () => {
    const terminal = createTerminal('terminal-acquire-error', ['10.0.6.1']);
    allowTerminalProxies(terminal);

    mockTokenBucket.mockImplementation(() => {
      return {
        read: () => 10,
        acquireSync: () => {
          throw new Error('unexpected runtime error');
        },
      };
    });

    expect(() =>
      acquireProxyBucket({
        baseKey: 'acquire-error-base',
        weight: 1,
        terminal,
        getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
      }),
    ).toThrow('E_PROXY_ACQUIRE_INTERNAL_ERROR');
  });

  it('should bind selected result to trusted terminalId when same ip appears multiple times', () => {
    const terminal = {
      terminal_id: 'terminal-binding',
      terminalInfos: [
        {
          terminal_id: 'trusted-proxy',
          tags: { ip: '10.0.7.1', ip_source: 'http-services' },
          serviceInfo: {
            HTTPProxyA: {
              method: 'HTTPProxy',
              schema: { type: 'object' },
            },
          },
        },
        {
          terminal_id: 'untrusted-proxy',
          tags: { ip: '10.0.7.1', ip_source: 'http-services' },
          serviceInfo: {
            HTTPProxyB: {
              method: 'HTTPProxy',
              schema: { type: 'object' },
            },
          },
        },
      ],
    } as unknown as Terminal;

    process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV] = 'trusted-proxy';

    mockTokenBucket.mockImplementation(() => {
      return {
        read: () => 10,
        acquireSync: () => {},
      };
    });

    const result = acquireProxyBucket({
      baseKey: 'binding-base',
      weight: 1,
      terminal,
      getBucketOptions: () => ({ capacity: 100, refillAmount: 100, refillInterval: 60_000 }),
    });

    expect(result.ip).toBe('10.0.7.1');
    expect(result.terminalId).toBe('trusted-proxy');
  });
});
