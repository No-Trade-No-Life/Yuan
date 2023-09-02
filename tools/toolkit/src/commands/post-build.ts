import { Command } from 'clipanion';
import { buildExtensionBundle } from '../features/buildExtensionBundle';

export class PostBuildCommand extends Command {
  static paths = [['post-build']];

  async execute(): Promise<number | void> {
    await buildExtensionBundle();

    return 0;
  }
}
