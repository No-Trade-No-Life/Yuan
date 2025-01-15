import { fs } from '../FileSystem';

/**
 * File is associated with Command
 */
export interface IAssociationRule {
  /** i18n_key = `association:${id}`  */
  id: string;
  priority?: number;

  match: (ctx: { path: string; isFile: boolean }) => boolean;
  action: (ctx: { path: string; isFile: boolean }) => void;
}

export const registerAssociationRule = (rule: IAssociationRule) => {
  associationRules.push(rule);
};

export const executeAssociatedRule = async (filename: string, rule_index = 0) => {
  const stat = await fs.stat(filename);
  const context = { path: filename, isFile: stat.isFile() };
  associationRules
    .filter((rule) => rule.match(context))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    [rule_index]?.action(context);
};

export const associationRules: IAssociationRule[] = [];
