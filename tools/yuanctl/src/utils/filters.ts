import { BOOLEAN_FIELDS, DEPLOYMENT_FIELDS, type DeploymentField } from '../constants';
import { escapeSQL } from '@yuants/sql';

export type FilterClause = {
  field: DeploymentField;
  value: string;
};

const FIELD_SET = new Set<DeploymentField>(DEPLOYMENT_FIELDS);

const normalizeKey = (key: string): DeploymentField | undefined => {
  const norm = key.trim();
  return FIELD_SET.has(norm as DeploymentField) ? (norm as DeploymentField) : undefined;
};

export const parseFilterExpression = (input: string | undefined): FilterClause[] => {
  if (!input) return [];
  return input
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) {
        throw new Error(`Invalid selector fragment "${pair}", expected "field=value"`);
      }
      const field = normalizeKey(pair.slice(0, eqIdx));
      if (!field) {
        throw new Error(`Unsupported selector field "${pair.slice(0, eqIdx)}"`);
      }
      const rawValue = pair.slice(eqIdx + 1);
      return {
        field,
        value: rawValue,
      };
    });
};

export interface SqlFilterOptions {
  include?: FilterClause[];
  identifierField?: DeploymentField;
  identifierValue?: string;
}

const coerceValue = (field: DeploymentField, value: string): string => {
  if (BOOLEAN_FIELDS.has(field)) {
    const lowered = value.toLowerCase();
    if (lowered !== 'true' && lowered !== 'false') {
      throw new Error(`Field "${field}" expects boolean value, received "${value}"`);
    }
    return lowered === 'true' ? 'true' : 'false';
  }
  return value;
};

export const buildWhereClause = (options: SqlFilterOptions): string => {
  const filters: FilterClause[] = [];
  if (options.include) {
    filters.push(...options.include);
  }
  if (options.identifierField && options.identifierValue) {
    filters.push({
      field: options.identifierField,
      value: options.identifierValue,
    });
  }
  if (filters.length === 0) {
    return '';
  }
  const clauses = filters.map(({ field, value }) => {
    const normalizedValue = coerceValue(field, value);
    if (BOOLEAN_FIELDS.has(field)) {
      return `${field} = ${normalizedValue}`;
    }
    return `${field} = ${escapeSQL(normalizedValue)}`;
  });
  return `WHERE ${clauses.join(' AND ')}`;
};

export interface SelectorOptions {
  selector?: string;
  fieldSelector?: string;
}

export const mergeSelectors = ({ selector, fieldSelector }: SelectorOptions): FilterClause[] => {
  const fromSelector = parseFilterExpression(selector);
  const fromFieldSelector = parseFilterExpression(fieldSelector);
  return [...fromSelector, ...fromFieldSelector];
};
