import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { loadCliClients } from '../context';
import { parseResource } from '../resource';
import { mergeSelectors } from '../../utils/filters';
import { confirmAction } from '../confirmation';
import type { RestartStrategy } from '../../client/deploymentsClient';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('restart');

const parseDuration = (value: string | undefined): number => {
  if (!value) return 5_000;
  if (value.endsWith('ms')) {
    return parseInt(value.slice(0, -2), 10);
  }
  if (value.endsWith('s')) {
    return parseFloat(value.slice(0, -1)) * 1000;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  throw new Error(`Invalid duration "${value}"`);
};

export class RestartCommand extends YuanctlCommand {
  static paths = [['restart']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });
  strategyOpt = Option.String('--strategy', {
    description: 'Restart strategy: touch|graceful|hard',
    required: false,
  });
  graceOpt = Option.String('--grace-period', {
    description: 'Grace period for graceful restart (e.g. 5s, 2000ms)',
    required: false,
  });

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    if (parsed.resource !== 'deployment' && parsed.resource !== 'deployments') {
      throw new Error('restart supports only deployment resources');
    }
    if (!parsed.identifier && !this.selectorOpt && !this.fieldSelectorOpt) {
      throw new Error('restart requires an identifier or selector');
    }
    const strategy = (this.strategyOpt ?? 'touch') as RestartStrategy;
    if (!['touch', 'graceful', 'hard'].includes(strategy)) {
      throw new Error(`Unsupported strategy "${strategy}"`);
    }
    if (this.forceConfirmOpt) {
      const targetLabel = parsed.identifier ?? [this.resource, this.nameArg].filter(Boolean).join(' ');
      const proceed = await confirmAction(`Confirm restart (${strategy}) for ${targetLabel}`);
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
    const grace = parseDuration(this.graceOpt ?? '5s');
    const restarted = await clients.deployments.restart(
      {
        filters,
        identifier: parsed.identifier ? { field: 'id', value: parsed.identifier } : undefined,
      },
      strategy,
      grace,
    );
    console.log(`Restarted ${restarted} deployment(s) with strategy "${strategy}"`);
  }
}
