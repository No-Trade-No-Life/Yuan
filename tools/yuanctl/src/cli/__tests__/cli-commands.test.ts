import { Cli } from 'clipanion';
import { PassThrough } from 'stream';
import type { CliClients } from '../context';
import type { IDeployment } from '@yuants/deploy';

jest.mock('../context', () => ({
  loadCliClients: jest.fn(),
}));

const { loadCliClients } = jest.requireMock('../context') as { loadCliClients: jest.Mock };
const { GetCommand } = require('../verbs/get') as typeof import('../verbs/get');
const { LogsCommand } = require('../verbs/logs') as typeof import('../verbs/logs');

const makeCli = () => {
  const cli = new Cli({
    binaryLabel: 'yuanctl-test',
    binaryName: 'yuanctl',
    binaryVersion: '0.0.0-test',
  });
  cli.register(GetCommand);
  cli.register(LogsCommand);
  return cli;
};

describe('CLI commands (mocked clients)', () => {
  let logs: string[];
  let errors: string[];
  let restoreLog: (() => void) | undefined;
  let restoreError: (() => void) | undefined;

  beforeEach(() => {
    loadCliClients.mockReset();
    if (!globalThis.crypto) {
      Object.assign(globalThis, { crypto: require('crypto').webcrypto });
    }
    logs = [];
    errors = [];
    const logSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      logs.push(args.map((v) => String(v)).join(' '));
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      errors.push(args.map((v) => String(v)).join(' '));
    });
    restoreLog = () => logSpy.mockRestore();
    restoreError = () => errorSpy.mockRestore();
  });

  afterEach(() => {
    restoreLog?.();
    restoreError?.();
  });

  it('renders deployments as json', async () => {
    const deployments: IDeployment[] = [
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
    const clients: Partial<CliClients> = {
      deployments: {
        list: jest.fn().mockResolvedValue(deployments),
        watch: jest.fn(),
      } as any,
      nodeUnits: { list: jest.fn() } as any,
      logs: { readSlice: jest.fn(), follow: jest.fn() } as any,
      config: { host: { defaultNodeUnit: 'node-1' } } as any,
      gateway: {} as any,
    };
    loadCliClients.mockResolvedValue(clients);
    const cli = makeCli();

    const exit = await cli.run(['get', 'deployments', '--output', 'json', '--no-headers'], {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    });

    expect(exit === undefined || exit === 0).toBe(true);
    expect(errors.join('')).toBe('');
    const parsed = JSON.parse(logs.join('\n').trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('bot-1');
  });

  it('reads log slice tail with explicit node unit', async () => {
    const deploymentRows: IDeployment[] = [
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
    const clients: Partial<CliClients> = {
      deployments: {
        list: jest.fn().mockResolvedValue(deploymentRows),
        watch: jest.fn(),
      } as any,
      nodeUnits: { list: jest.fn() } as any,
      logs: {
        readSlice: jest.fn().mockResolvedValue({
          content: 'line-1\nline-2\nline-3\n',
          start: 0,
          end: 0,
          file_size: 0,
        }),
        follow: jest.fn(),
      } as any,
      config: { host: { defaultNodeUnit: 'node-1' } } as any,
      gateway: {} as any,
    };
    loadCliClients.mockResolvedValue(clients);
    const cli = makeCli();

    const exit = await cli.run(
      ['logs', 'deployment/bot-1', '--tail', '2', '--node-unit', 'node-1', '--timestamps'],
      {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      },
    );

    expect(exit === undefined || exit === 0).toBe(true);
    expect(errors.join('')).toBe('');
    const lines = logs
      .join('\n')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('line-3');
    expect(clients.logs?.readSlice).toHaveBeenCalled();
  });
});
