import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { loadCliClients } from '../context';
import { parseResource } from '../resource';
import { mergeSelectors } from '../../utils/filters';
import { confirmAction } from '../confirmation';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('delete');

export class DeleteCommand extends YuanctlCommand {
  static paths = [['delete']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    if (parsed.resource !== 'deployment' && parsed.resource !== 'deployments') {
      throw new Error('delete supports only deployment resources');
    }
    if (!parsed.identifier && !this.selectorOpt && !this.fieldSelectorOpt) {
      throw new Error('delete requires an identifier or selector');
    }
    const targetLabel = parsed.identifier ?? [this.resource, this.nameArg].filter(Boolean).join(' ');
    const proceed = await confirmAction(`Confirm delete for ${targetLabel}`);
    if (!proceed) {
      console.log('Aborted');
      return;
    }
    const clients = await loadCliClients(this.globalOptions);
    const filters = mergeSelectors({
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
    });
    if (parsed.identifier) {
      filters.push({ field: 'id', value: parsed.identifier });
    }
    const deleted = await clients.deployments.delete({
      filters,
      identifier: parsed.identifier ? { field: 'id', value: parsed.identifier } : undefined,
    });
    console.log(`Deleted ${deleted} deployment(s)`);
  }
}
