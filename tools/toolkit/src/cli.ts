import { Builtins, Cli } from 'clipanion';
import { PostBuildCommand } from './commands/post-build';

const [node, app, ...args] = process.argv;

const cli = new Cli({
  binaryLabel: `Yuan Tool-kit`,
  binaryName: `${node} ${app}`,
  binaryVersion: `0.0.0`,
});

cli.register(PostBuildCommand);
cli.register(Builtins.HelpCommand);
cli.runExit(args);
