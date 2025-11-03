import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { loadCliClients } from '../context';
import { parseResource } from '../resource';
import { DEFAULT_TAIL_LINES, MAX_TAIL_LINES } from '../../constants';
import { mergeSelectors } from '../../utils/filters';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('logs');

const formatLine = (line: string, options: { prefix?: string; timestamps?: boolean }): string => {
  const parts: string[] = [];
  if (options.timestamps) {
    parts.push(new Date().toISOString());
  }
  if (options.prefix) {
    parts.push(options.prefix);
  }
  parts.push(line);
  return parts.join(' ');
};

const computeTail = (value: number | undefined): number => {
  if (value === undefined || Number.isNaN(value)) {
    return DEFAULT_TAIL_LINES;
  }
  if (value <= 0) {
    throw new Error('--tail should be positive');
  }
  return Math.min(value, MAX_TAIL_LINES);
};

export class LogsCommand extends YuanctlCommand {
  static paths = [['logs']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });
  followOpt = Option.Boolean('-f,--follow', { description: 'Follow logs' });
  tailOpt = Option.String('--tail', {
    description: 'Number of lines from the end of the logs',
    required: false,
  });
  sinceOpt = Option.String('--since', {
    description: 'Duration to look back (not yet supported)',
    required: false,
  });
  nodeUnitOpt = Option.String('--node-unit', { description: 'Explicit node unit address', required: false });
  prefixOpt = Option.Boolean('--prefix', { description: 'Prefix each log line with the identifier' });
  timestampsOpt = Option.Boolean('--timestamps', { description: 'Include ISO timestamps in output' });
  fileIndexOpt = Option.String('--file-index', {
    description: 'Optional log file index for rotated logs',
    required: false,
  });

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    if (parsed.resource !== 'deployment' && parsed.resource !== 'deployments') {
      throw new Error('logs command currently supports only deployments');
    }
    const clients = await loadCliClients(this.globalOptions);
    const filters = mergeSelectors({
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
    });
    if (parsed.identifier) {
      filters.push({ field: 'id', value: parsed.identifier });
    }
    const deployments = await clients.deployments.list({
      filters,
      identifier: parsed.identifier ? { field: 'id', value: parsed.identifier } : undefined,
      limit: 5,
    });
    if (deployments.length === 0) {
      console.error('deployment not found');
      process.exitCode = 1;
      return;
    }
    if (deployments.length > 1 && !parsed.identifier) {
      console.error('selector matches multiple deployments; specify a unique identifier');
      process.exitCode = 1;
      return;
    }
    const deployment = deployments[0];
    const identifier = parsed.identifier ?? deployment.id;
    const nodeUnit =
      this.nodeUnitOpt ??
      deployment.address ??
      clients.config.host.defaultNodeUnit ??
      (() => {
        throw new Error(
          'Unable to determine node unit address. Use --node-unit or configure default_node_unit in context.',
        );
      })();

    if (this.sinceOpt) {
      console.warn('--since is not yet supported and will be ignored');
    }

    if (this.followOpt) {
      clients.logs
        .follow({
          deploymentId: identifier,
          nodeUnit,
        })
        .subscribe({
          next: (chunk) => {
            chunk
              .split(/\r?\n/)
              .filter((line) => line.length > 0)
              .forEach((line) =>
                console.log(
                  formatLine(line, {
                    prefix: this.prefixOpt ? identifier : undefined,
                    timestamps: this.timestampsOpt,
                  }),
                ),
              );
          },
          error: (err) => {
            console.error('Log streaming failed:', err);
            process.exitCode = 1;
          },
        });
      return;
    }

    const tailValue = this.tailOpt !== undefined ? Number(this.tailOpt) : undefined;
    const tail = computeTail(tailValue);
    const fileIndex =
      this.fileIndexOpt !== undefined
        ? (() => {
            const parsed = Number(this.fileIndexOpt);
            if (Number.isNaN(parsed)) {
              throw new Error('--file-index must be a number');
            }
            return parsed;
          })()
        : undefined;
    const result = await clients.logs.readSlice({
      deploymentId: identifier,
      start: -128 * 1024,
      fileIndex,
    });
    const lines = result.content.split(/\r?\n/).filter((line) => line.length > 0);
    const tailLines = lines.slice(-tail);
    tailLines.forEach((line) =>
      console.log(
        formatLine(line, {
          prefix: this.prefixOpt ? identifier : undefined,
          timestamps: this.timestampsOpt,
        }),
      ),
    );
  }
}
