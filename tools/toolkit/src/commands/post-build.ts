import { Command } from 'clipanion';
import { buildDependencyHash } from '../features/buildDependencyHash';
import { buildDockerImage } from '../features/buildDockerImage';
import { buildExtensionBundle } from '../features/buildExtensionBundle';

export class PostBuildCommand extends Command {
  static paths = [['post-build']];

  async execute(): Promise<number | void> {
    await buildDependencyHash();
    await buildDockerImage();
    await buildExtensionBundle();

    return 0;
  }
}
