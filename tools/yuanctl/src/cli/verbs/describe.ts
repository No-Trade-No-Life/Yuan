import { Command, Option } from 'clipanion';
import { YuanctlCommand } from '../baseCommand';
import { loadCliClients } from '../context';
import { parseResource } from '../resource';
import { mergeSelectors } from '../../utils/filters';
import { renderDeploymentDescribe, renderNodeUnitDescribe } from '../../printers/describeRenderer';
import { getCommandHelp } from '../commandMetadata';

const HELP = getCommandHelp('describe');

export class DescribeCommand extends YuanctlCommand {
  static paths = [['describe']];
  static usage = Command.Usage({
    category: HELP.group,
    description: HELP.description,
    examples: HELP.examples,
  });

  resource = Option.String({ name: 'resource', required: true });
  nameArg = Option.String({ name: 'name', required: false });

  async execute(): Promise<void> {
    const parsed = parseResource(this.resource, this.nameArg);
    const clients = await loadCliClients(this.globalOptions);
    const filters = mergeSelectors({
      selector: this.selectorOpt ?? undefined,
      fieldSelector: this.fieldSelectorOpt ?? undefined,
    });
    if (!parsed.identifier && filters.length === 0) {
      throw new Error('Describe requires an identifier or selector');
    }

    if (parsed.resource === 'deployment' || parsed.resource === 'deployments') {
      const deployments = await clients.deployments.list({
        filters,
        identifier: parsed.identifier
          ? {
              field: 'id',
              value: parsed.identifier,
            }
          : undefined,
        limit: 10,
      });
      if (deployments.length === 0) {
        console.error('deployment not found');
        process.exitCode = 1;
        return;
      }
      deployments.forEach((deployment, index) => {
        if (index > 0) {
          console.log('\n---\n');
        }
        console.log(renderDeploymentDescribe(deployment));
      });
      return;
    }

    if (parsed.resource === 'nodeunits') {
      const nodes = await clients.nodeUnits.list();
      const match = parsed.identifier
        ? nodes.find((node) => node.address === parsed.identifier || node.name === parsed.identifier)
        : nodes[0];
      if (!match) {
        console.error('nodeunit not found');
        process.exitCode = 1;
        return;
      }
      console.log(renderNodeUnitDescribe(match));
      return;
    }

    throw new Error(`Resource "${parsed.resource}" is not supported by describe`);
  }
}
