import { Cli, Builtins } from 'clipanion';
import { createRequire } from 'module';
import { GetCommand } from './verbs/get';
import { DescribeCommand } from './verbs/describe';
import { EnableCommand, DisableCommand } from './verbs/enableDisable';
import { DeleteCommand } from './verbs/delete';
import { RestartCommand } from './verbs/restart';
import { LogsCommand } from './verbs/logs';
import { ConfigInitCommand } from './verbs/configInit';
import { configureRootHelp } from './help';
import { maybeCheckForUpdates } from '../updateChecker';

const requireForVersion = createRequire(__dirname);

const resolvePackageVersion = (): string => {
  try {
    const pkg = requireForVersion('../../package.json');
    if (pkg && typeof pkg.version === 'string') {
      return pkg.version;
    }
  } catch {
    // ignore
  }
  return '0.0.0';
};

const YUANCTL_VERSION = resolvePackageVersion();

const createCli = () => {
  const cli = new Cli({
    binaryLabel: 'yuanctl',
    binaryName: 'yuanctl',
    binaryVersion: YUANCTL_VERSION,
  });
  cli.register(GetCommand);
  cli.register(DescribeCommand);
  cli.register(EnableCommand);
  cli.register(DisableCommand);
  cli.register(DeleteCommand);
  cli.register(RestartCommand);
  cli.register(LogsCommand);
  cli.register(ConfigInitCommand);
  cli.register(Builtins.HelpCommand);
  configureRootHelp(cli);
  return cli;
};

export const run = async (argv: string[]) => {
  const cli = createCli();
  await maybeCheckForUpdates(YUANCTL_VERSION);
  const [, , ...args] = argv;
  try {
    const exitCode = await cli.run(args, {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    });
    if (typeof exitCode === 'number') {
      process.exitCode = exitCode;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
};
