import { Command, Option } from 'clipanion';
import { generateDefaultToml } from '../../config/defaultConfig';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('config-init');

export class ConfigInitCommand extends Command {
  static paths = [['config-init']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  hostUrl = Option.String('--host-url', { description: 'Override host URL in template', required: false });
  terminalId = Option.String('--terminal-id', {
    description: 'Override terminal id in template',
    required: false,
  });

  async execute(): Promise<void> {
    const content = generateDefaultToml({
      hostUrl: this.hostUrl ?? undefined,
      terminalId: this.terminalId ?? undefined,
    });
    console.log(content);
  }
}
