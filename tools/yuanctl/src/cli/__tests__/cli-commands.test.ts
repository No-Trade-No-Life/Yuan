import { PassThrough } from 'stream';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

jest.mock('../../updateChecker', () => ({
  maybeCheckForUpdates: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../client/terminalGateway', () => ({
  TerminalGateway: {
    ensure: jest.fn().mockResolvedValue({ terminal: {} }),
  },
}));

jest.mock('../../client/deploymentsClient', () => ({
  DeploymentsClient: jest.fn().mockImplementation(() => ({
    list: jest.fn(),
    getById: jest.fn(),
    setEnabled: jest.fn(),
    restart: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('../../client/logsClient', () => ({
  LogsClient: jest.fn().mockImplementation(() => ({
    readSlice: jest.fn(),
  })),
}));

jest.mock('../../config/clientConfig', () => ({
  loadClientConfig: jest.fn(),
}));

const { run, registry } = require('../index') as typeof import('../index');
const { resolveCommand, buildStaticRegistry } =
  require('../static-registry') as typeof import('../static-registry');
const { loadClientConfig } = jest.requireMock('../../config/clientConfig') as {
  loadClientConfig: jest.Mock;
};
const { DeploymentsClient } = jest.requireMock('../../client/deploymentsClient') as {
  DeploymentsClient: jest.Mock;
};

const makeIo = () => {
  const configRoot = mkdtempSync(join(tmpdir(), 'yuanctl-test-'));
  const stdin = new PassThrough() as unknown as NodeJS.ReadStream;
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream;
  const stderr = new PassThrough() as unknown as NodeJS.WriteStream;
  Object.assign(stdout, { isTTY: false });
  Object.assign(stderr, { isTTY: false });
  return {
    stdin,
    stdout,
    stderr,
    env: {
      ...process.env,
      YUANCTL_DISABLE_UPDATE_CHECK: '1',
      XDG_CONFIG_HOME: configRoot,
    },
    cleanup: () => rmSync(configRoot, { recursive: true, force: true }),
    configRoot,
  };
};

const readStream = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  await new Promise((resolve) => setImmediate(resolve));
  return Buffer.concat(chunks).toString('utf-8');
};

describe('yuanctl phase 1 CLI', () => {
  beforeEach(() => {
    loadClientConfig.mockReset();
    DeploymentsClient.mockClear();
  });

  it('resolves deploy namespace commands from static registry', () => {
    const resolved = resolveCommand(['deploy', 'inspect', 'bot-1'], registry);
    expect(resolved.kind).toBe('command');
    if (resolved.kind === 'command') {
      expect(resolved.command.path).toEqual(['deploy', 'inspect']);
      expect(resolved.command.positionals).toEqual(['bot-1']);
    }
  });

  it('rejects registry conflicts with source package details', () => {
    expect(() =>
      buildStaticRegistry([
        {
          commands: [
            {
              path: ['deploy', 'list'],
              summary: '',
              capabilityClass: 'read-safe',
              sourcePackage: 'a',
              runtime: 'none',
              handler: jest.fn(),
            },
          ],
        },
        {
          commands: [
            {
              path: ['deploy', 'list'],
              summary: '',
              capabilityClass: 'read-safe',
              sourcePackage: 'b',
              runtime: 'none',
              handler: jest.fn(),
            },
          ],
        },
      ]),
    ).toThrow('Command path conflict');
  });

  it('runs deploy list and renders json result', async () => {
    const deployments = [
      {
        id: 'bot-1',
        package_name: '@yuants/bot',
        package_version: '1.0.0',
        command: '',
        args: [],
        env: {},
        address: 'node-1',
        type: 'deployment',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    loadClientConfig.mockReturnValue({
      ok: true,
      value: {
        contextName: 'default',
        host: { name: 'default', hostUrl: 'ws://host', terminalId: 't-1' },
      },
    });
    DeploymentsClient.mockImplementation(() => ({
      list: jest.fn().mockResolvedValue(deployments),
      getById: jest.fn(),
      setEnabled: jest.fn(),
      restart: jest.fn(),
      delete: jest.fn(),
    }));

    const io = makeIo();
    try {
      const exitCode = await run(['node', 'yuanctl', 'deploy', 'list', '--output', 'json'], io);
      const stdout = await readStream(io.stdout as unknown as PassThrough);
      const stderr = await readStream(io.stderr as unknown as PassThrough);

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      const parsed = JSON.parse(stdout);
      expect(parsed.kind).toBe('deploy.list');
      expect(parsed.data[0].id).toBe('bot-1');
    } finally {
      io.cleanup();
    }
  });

  it('runs config init without loading existing config', async () => {
    const io = makeIo();
    try {
      const exitCode = await run(['node', 'yuanctl', 'config', 'init', '--host-url', 'ws://demo'], io);
      const stdout = await readStream(io.stdout as unknown as PassThrough);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('current_context');
      expect(stdout).toContain('ws://demo');
      expect(loadClientConfig).not.toHaveBeenCalled();
    } finally {
      io.cleanup();
    }
  });

  it('shows namespace help for config', async () => {
    const io = makeIo();
    try {
      const exitCode = await run(['node', 'yuanctl', 'config', '--help'], io);
      const stdout = await readStream(io.stdout as unknown as PassThrough);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('yuanctl config <subcommand>');
      expect(stdout).toContain('get-contexts');
    } finally {
      io.cleanup();
    }
  });

  it('runs config current basic path', async () => {
    const io = makeIo();
    try {
      mkdirSync(join(io.configRoot, 'yuan'), { recursive: true });
      writeFileSync(
        join(io.configRoot, 'yuan', 'config.toml'),
        [
          'current_context = "prod"',
          '',
          '[hosts.prod-host]',
          'host_url = "wss://prod/ws"',
          'terminal_id = "term-1"',
          '',
          '[contexts.prod]',
          'host = "prod-host"',
          '',
        ].join('\n'),
      );

      const exitCode = await run(['node', 'yuanctl', 'config', 'current', '--output', 'json'], io);
      const stdout = await readStream(io.stdout as unknown as PassThrough);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.kind).toBe('config.current');
      expect(parsed.data.currentContextName).toBe('prod');
      expect(parsed.data.hostUrl).toBe('wss://prod/ws');
    } finally {
      io.cleanup();
    }
  });

  it('blocks destructive command without --yes in non-tty mode', async () => {
    loadClientConfig.mockReturnValue({
      ok: true,
      value: {
        contextName: 'default',
        host: { name: 'default', hostUrl: 'ws://host', terminalId: 't-1' },
      },
    });
    const io = makeIo();
    try {
      const exitCode = await run(['node', 'yuanctl', 'deploy', 'delete', 'bot-1', '--output', 'json'], io);
      const stderr = await readStream(io.stderr as unknown as PassThrough);

      expect(exitCode).toBe(6);
      const parsed = JSON.parse(stderr);
      expect(parsed.error.code).toBe('E_CONFIRMATION_REQUIRED');
    } finally {
      io.cleanup();
    }
  });

  it('rejects unsafe host url in config init', async () => {
    const io = makeIo();
    try {
      const exitCode = await run(['node', 'yuanctl', 'config', 'init', '--host-url', 'file:///tmp/demo'], io);
      const stderr = await readStream(io.stderr as unknown as PassThrough);

      expect(exitCode).toBe(2);
      expect(stderr).toContain('Host URL must use ws:// or wss://');
    } finally {
      io.cleanup();
    }
  });
});
