import { createValidator } from '@yuants/protocol/lib/schema';
import type { IAlertReceiveRoute, IAlertRecord } from '../types';

type Validator = (data: unknown) => boolean;

const validatorCache = new WeakMap<IAlertReceiveRoute, Validator | undefined>();

const getValidatorState = (route: IAlertReceiveRoute): Validator | undefined => {
  const cached = validatorCache.get(route);
  if (cached) return cached;

  const schema = route.label_schema;
  if (!schema) {
    validatorCache.set(route, undefined);
    return undefined;
  }

  try {
    const validator = createValidator({ ...schema, type: schema.type ?? 'object' });
    validatorCache.set(route, validator);
    return validator;
  } catch (error) {
    console.info(Date.now(), 'LabelSchemaValidatorCreationFailed', error);
    validatorCache.set(route, undefined);

    return undefined;
  }
};

export const filterAlertsByRoute = (route: IAlertReceiveRoute, alerts: IAlertRecord[]): IAlertRecord[] => {
  const validator = getValidatorState(route);
  if (!validator) {
    return alerts;
  }

  const matched: IAlertRecord[] = [];

  for (const alert of alerts) {
    if (validator(alert.labels ?? {})) {
      matched.push(alert);
    }
  }

  return matched;
};
