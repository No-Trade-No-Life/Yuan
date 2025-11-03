import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { parseResource } from '../resource';
import { mergeSelectors } from '../../utils/filters';
import { confirmAction } from '../confirmation';
import { loadCliClients } from '../context';
import { getCommandHelp } from '../commandMetadata';

const ENABLE_HELP = getCommandHelp('enable');
const DISABLE_HELP = getCommandHelp('disable');

abstract class ToggleCommandBase extends YuanctlCommand {
  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });

  protected abstract readonly verb: 'enable' | 'disable';

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    if (parsed.resource !== 'deployment' && parsed.resource !== 'deployments') {
      throw new Error(`${this.verb} supports only deployment resources`);
    }
    if (!parsed.identifier && !this.selectorOpt && !this.fieldSelectorOpt) {
      throw new Error(`${this.verb} requires an identifier or selector`);
    }
    if (this.forceConfirmOpt) {
      const targetLabel = parsed.identifier ?? [this.resource, this.nameArg].filter(Boolean).join(' ');
      const proceed = await confirmAction(`Confirm ${this.verb} for ${targetLabel}`);
      if (!proceed) {
        console.log('Aborted');
        return;
      }
    }
    const clients = await loadCliClients(this.globalOptions);
    const filters = mergeSelectors({
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
    });
    if (parsed.identifier) {
      filters.push({ field: 'id', value: parsed.identifier });
    }
    const updated = await clients.deployments.setEnabled(
      {
        filters,
        identifier: parsed.identifier ? { field: 'id', value: parsed.identifier } : undefined,
      },
      this.verb === 'enable',
    );
    console.log(`${this.verb === 'enable' ? 'Enabled' : 'Disabled'} ${updated} deployment(s)`);
  }
}

export class EnableCommand extends ToggleCommandBase {
  static paths = [['enable']];
  static usage = Command.Usage({
    category: ENABLE_HELP.group,
    description: ENABLE_HELP.description,
    examples: ENABLE_HELP.examples,
  });

  protected readonly verb = 'enable' as const;
}

export class DisableCommand extends ToggleCommandBase {
  static paths = [['disable']];
  static usage = Command.Usage({
    category: DISABLE_HELP.group,
    description: DISABLE_HELP.description,
    examples: DISABLE_HELP.examples,
  });

  protected readonly verb = 'disable' as const;
}
