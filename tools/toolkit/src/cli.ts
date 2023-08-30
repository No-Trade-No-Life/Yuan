import { Cli } from 'clipanion';
import { HelpCommand } from 'clipanion/lib/advanced/builtins';
import { PostBuildCommand } from './commands/post-build';

const [node, app, ...args] = process.argv;

const cli = new Cli({
  binaryLabel: `Yuan Tool-kit`,
  binaryName: `${node} ${app}`,
  binaryVersion: `0.0.0`,
});

cli.register(PostBuildCommand);
cli.register(HelpCommand);
cli.runExit(args);
