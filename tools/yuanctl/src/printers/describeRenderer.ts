import type { IDeployment } from '@yuants/deploy';
import type { NodeUnitInfo } from '../client/nodeUnitsClient';
import { bold } from '../utils/ansi';

export const renderDeploymentDescribe = (deployment: IDeployment): string => {
  const lines: string[] = [];
  lines.push(bold('Name:'), `  ${deployment.id}`);
  lines.push(bold('Package:'), `  ${deployment.package_name}@${deployment.package_version}`);
  lines.push(bold('Command:'), `  ${deployment.command}`);
  lines.push(bold('Args:'), `  ${JSON.stringify(deployment.args ?? [])}`);
  lines.push(bold('Env:'), `  ${JSON.stringify(deployment.env ?? {})}`);
  lines.push(bold('Address:'), `  ${deployment.address || '(auto)'}`);
  lines.push(bold('Enabled:'), `  ${deployment.enabled}`);
  lines.push(bold('Created At:'), `  ${deployment.created_at}`);
  lines.push(bold('Updated At:'), `  ${deployment.updated_at}`);
  lines.push(bold('Logs:'), `  yuanctl logs deployment/${deployment.id} --tail=200`);
  return lines.join('\n');
};

export const renderNodeUnitDescribe = (node: NodeUnitInfo): string => {
  const lines: string[] = [];
  lines.push(bold('Address:'), `  ${node.address}`);
  lines.push(bold('Name:'), `  ${node.name}`);
  lines.push(bold('Version:'), `  ${node.version}`);
  lines.push(bold('Logs:'), `  yuanctl get deployments --selector address=${node.address}`);
  return lines.join('\n');
};
