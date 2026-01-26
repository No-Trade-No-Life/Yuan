import { TreeNode } from './tree';
import { Labels } from './types';

export const sortLabels = (labels: Labels): [string, string][] => {
  return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
};

export const labelsToString = (labels: [string, string][]): string => {
  return labels.length ? `{${labels.map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
};

export const createConstNode = (node: TreeNode, key: string, value: string) => {
  const constNode = node.getChild(key, true);
  constNode.setValue(value);
  return constNode;
};

export const createLabelKeyNode = (node: TreeNode, name: string, labels: [string, string][]) => {
  const label = `${name}${labelsToString(labels)} `;
  const theNode = node.getChild(label, true);
  createConstNode(theNode, 'label', label);
  const valueNode = theNode.getChild<number>('value', true);
  if (valueNode.getValue() === null) {
    valueNode.setValue(0);
  }
  createConstNode(theNode, 'tail', '\n');
  return valueNode;
};
