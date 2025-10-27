import { createValidator } from '@yuants/protocol/lib/schema';
import { formatTime } from '@yuants/utils';
import type { JSONSchema7 } from 'json-schema';
import type { IAlertLabelRule, IAlertRecord } from '../types';

const LABEL_RULE_SCHEMA: JSONSchema7 = {
  type: 'object',
  required: ['key', 'operator', 'value'],
  properties: {
    key: { type: 'string' },
    operator: { type: 'string', enum: ['==', '!=', '=~', '!~'] },
    value: { type: 'string' },
  },
};

const LABEL_FILTERS_SCHEMA: JSONSchema7 = {
  type: 'array',
  items: LABEL_RULE_SCHEMA,
};

const validateLabelFilters = createValidator(LABEL_FILTERS_SCHEMA as JSONSchema7);

export const normalizeLabelFilters = (rawFilters: IAlertLabelRule[]): IAlertLabelRule[] => {
  let parsedFilters = rawFilters;

  if (!validateLabelFilters(parsedFilters)) {
    console.info(formatTime(Date.now()), 'LabelFiltersValidationFailed', parsedFilters);
    return [];
  }

  const seenKeys = new Set<string>();
  const nextFilters: IAlertLabelRule[] = [];

  for (const rule of parsedFilters as IAlertLabelRule[]) {
    if (!rule || typeof rule !== 'object') continue;
    const key = (rule as any).key;
    if (typeof key !== 'string') continue;
    if (seenKeys.has(key)) {
      console.info(formatTime(Date.now()), 'DuplicateLabelFilterKeyIgnored', key);
      continue;
    }
    seenKeys.add(key);
    nextFilters.push(rule as IAlertLabelRule);
  }

  return nextFilters;
};

export const matchLabelRule = (labels: Record<string, string>, rule: IAlertLabelRule): boolean => {
  const value = labels[rule.key];
  switch (rule.operator) {
    case '==':
      return value !== undefined && value === rule.value;
    case '!=':
      return value === undefined || value !== rule.value;
    case '=~': {
      if (value === undefined) return false;
      try {
        return new RegExp(rule.value).test(value);
      } catch (e) {
        console.info(formatTime(Date.now()), 'InvalidLabelRegex', rule.value);
        return false;
      }
    }
    case '!~': {
      if (value === undefined) return true;
      try {
        return !new RegExp(rule.value).test(value);
      } catch (e) {
        console.info(formatTime(Date.now()), 'InvalidLabelRegex', rule.value);
        return false;
      }
    }
    default:
      console.info(formatTime(Date.now()), 'UnknownLabelOperator', rule.operator);
      return false;
  }
};

export const shouldDeliver = (filters: IAlertLabelRule[], alerts: IAlertRecord[]): boolean => {
  if (!filters || filters.length === 0) return true;
  return alerts.some((alert) => filters.every((rule) => matchLabelRule(alert.labels ?? {}, rule)));
};
