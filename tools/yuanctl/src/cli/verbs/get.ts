import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { loadCliClients } from '../context';
import { parseResource } from '../resource';
import { mergeSelectors } from '../../utils/filters';
import { TablePrinter, type TableColumn } from '../../printers/tablePrinter';
import { stringify as stringifyYaml } from 'yaml';
import type { IDeployment } from '@yuants/deploy';
import { gray } from '../../utils/ansi';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('get');

interface GetFormatOptions {
  noHeaders?: boolean;
  wide?: boolean;
}

const renderDeploymentsTable = (rows: IDeployment[], options: GetFormatOptions) => {
  const baseColumns: TableColumn<IDeployment>[] = [
    { key: 'id', header: 'NAME', width: 36 },
    { key: 'package_name', header: 'PACKAGE', width: 28 },
    { key: 'package_version', header: 'VERSION', width: 12 },
    { key: 'enabled', header: 'ENABLED' },
    { key: 'address', header: 'NODE_UNIT', width: 40 },
    { key: 'updated_at', header: 'UPDATED', width: 24 },
  ];
  const wideColumns: TableColumn<IDeployment>[] = [
    ...baseColumns,
    {
      key: 'command',
      header: 'COMMAND',
      width: 20,
    },
    {
      key: 'args',
      header: 'ARGS',
      width: 30,
      format: (value: unknown) => JSON.stringify(value ?? []),
    },
  ];
  const selectedColumns = options.wide ? wideColumns : baseColumns;
  const printer = new TablePrinter(selectedColumns, {
    noHeaders: options.noHeaders,
  });
  printer.print(rows);
};

const renderNodeUnitsTable = (
  rows: { address: string; name: string; version: string }[],
  options: { noHeaders?: boolean },
) => {
  const printer = new TablePrinter(
    [
      { key: 'address', header: 'ADDRESS', width: 44 },
      { key: 'name', header: 'NAME', width: 20 },
      { key: 'version', header: 'VERSION', width: 12 },
    ],
    { noHeaders: options.noHeaders },
  );
  printer.print(rows);
};

const renderDeployments = (format: string | undefined, rows: IDeployment[], options: GetFormatOptions) => {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(rows, null, 2));
      return;
    case 'yaml':
      console.log(stringifyYaml(rows));
      return;
    case 'wide':
    case undefined:
    case 'table':
      renderDeploymentsTable(rows, {
        noHeaders: options.noHeaders,
        wide: format === 'wide' || options.wide,
      });
      return;
    default:
      throw new Error(`Unsupported output format "${format}"`);
  }
};

const renderNodeUnits = (format: string | undefined, rows: any[], options: { noHeaders?: boolean }) => {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(rows, null, 2));
      return;
    case 'yaml':
      console.log(stringifyYaml(rows));
      return;
    case undefined:
    case 'table':
    case 'wide':
      renderNodeUnitsTable(rows, { noHeaders: options.noHeaders });
      return;
    default:
      throw new Error(`Unsupported output format "${format}"`);
  }
};

export class GetCommand extends YuanctlCommand {
  static paths = [['get']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });
  watchOpt = Option.Boolean('--watch', { description: 'Watch for changes' });

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    const clients = await loadCliClients(this.globalOptions);
    const filters = mergeSelectors({
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
    });
    if (parsed.identifier) {
      filters.push({
        field: parsed.resource === 'deployment' ? 'id' : 'id',
        value: parsed.identifier,
      });
    }

    const outputFormat = this.outputOpt ?? 'table';
    const omitHeaders = this.noHeadersOpt;
    const useWideColumns = this.wideOpt || outputFormat === 'wide';

    if (parsed.resource === 'deployments' || parsed.resource === 'deployment') {
      const list = async () =>
        clients.deployments.list({
          filters,
          identifier: parsed.identifier
            ? {
                field: 'id',
                value: parsed.identifier,
              }
            : undefined,
        });

      if (this.watchOpt) {
        clients.deployments
          .watch({
            filters,
            identifier: parsed.identifier
              ? {
                  field: 'id',
                  value: parsed.identifier,
                }
              : undefined,
          })
          .subscribe({
            next: (rows) => {
              console.clear();
              console.log(gray(new Date().toISOString()));
              renderDeployments(outputFormat, rows, {
                noHeaders: omitHeaders,
                wide: useWideColumns,
              });
            },
            error: (err) => {
              console.error('Watch failed:', err);
              process.exitCode = 1;
            },
          });
        return;
      }

      const rows = await list();
      renderDeployments(outputFormat, rows, {
        noHeaders: omitHeaders,
        wide: useWideColumns,
      });
      return;
    }

    if (parsed.resource === 'nodeunits') {
      const rows = await clients.nodeUnits.list();
      renderNodeUnits(outputFormat, rows, { noHeaders: omitHeaders });
      return;
    }

    throw new Error(`Resource "${parsed.resource}" is not supported by get`);
  }
}
