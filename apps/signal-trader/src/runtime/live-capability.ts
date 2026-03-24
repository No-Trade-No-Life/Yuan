import { createHash } from 'node:crypto';
import {
  SignalTraderLiveCapabilityDescriptor,
  SignalTraderLiveCapabilityRegistry,
  SignalTraderLiveCapabilitySummary,
} from '../types';

const MINIMUM_LIVE_CAPABILITY_FLAGS = [
  'supports_submit',
  'supports_cancel_by_external_operate_order_id',
  'supports_closed_order_history',
  'supports_open_orders',
  'supports_account_snapshot',
  'supports_authorize_order_account_check',
] as const satisfies ReadonlyArray<keyof SignalTraderLiveCapabilityDescriptor>;

export type LiveCapabilityFailureReason =
  | 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED'
  | 'LIVE_CAPABILITY_DESCRIPTOR_MISSING'
  | 'LIVE_CAPABILITY_DESCRIPTOR_KEY_MISMATCH'
  | 'LIVE_CAPABILITY_DESCRIPTOR_EVIDENCE_MISSING'
  | 'LIVE_CAPABILITY_DESCRIPTOR_INSUFFICIENT';

export type LiveCapabilityValidationResult =
  | {
      ok: true;
      descriptor: SignalTraderLiveCapabilityDescriptor;
      descriptor_hash: string;
    }
  | {
      ok: false;
      reason: LiveCapabilityFailureReason;
      descriptor?: SignalTraderLiveCapabilityDescriptor;
      descriptor_hash?: string;
      missing_capabilities?: string[];
    };

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const cloneDescriptor = (descriptor: SignalTraderLiveCapabilityDescriptor) =>
  JSON.parse(
    JSON.stringify({
      key: descriptor.key,
      supports_submit: descriptor.supports_submit,
      supports_cancel_by_external_operate_order_id: descriptor.supports_cancel_by_external_operate_order_id,
      supports_closed_order_history: descriptor.supports_closed_order_history,
      supports_open_orders: descriptor.supports_open_orders,
      supports_account_snapshot: descriptor.supports_account_snapshot,
      supports_authorize_order_account_check: descriptor.supports_authorize_order_account_check,
      evidence_source: descriptor.evidence_source,
    }),
  ) as SignalTraderLiveCapabilityDescriptor;

export const getLiveCapabilityDescriptorHash = (descriptor: SignalTraderLiveCapabilityDescriptor) =>
  createHash('sha256').update(stableStringify(descriptor)).digest('hex');

export const summarizeLiveCapabilityDescriptor = (
  descriptor: SignalTraderLiveCapabilityDescriptor,
): SignalTraderLiveCapabilitySummary => ({
  ...cloneDescriptor(descriptor),
  observer_backend: descriptor.key,
  descriptor_hash: getLiveCapabilityDescriptorHash(descriptor),
});

export const createStaticLiveCapabilityRegistry = (
  descriptors: SignalTraderLiveCapabilityDescriptor[],
): SignalTraderLiveCapabilityRegistry => {
  const summaries = descriptors.map(summarizeLiveCapabilityDescriptor);
  const index = new Map(summaries.map((item) => [item.key, item]));
  return {
    list: async () => summaries.map((item) => cloneDescriptor(item)),
    resolve: async ({ observer_backend }) => {
      const matched = index.get(observer_backend);
      return matched ? cloneDescriptor(matched) : undefined;
    },
  };
};

export const validateLiveCapabilityDescriptor = (
  observerBackend: string,
  descriptor?: SignalTraderLiveCapabilityDescriptor,
): LiveCapabilityValidationResult => {
  if (!descriptor) {
    return { ok: false, reason: 'LIVE_CAPABILITY_DESCRIPTOR_MISSING' };
  }
  const descriptorHash = getLiveCapabilityDescriptorHash(descriptor);
  if (!descriptor.key || descriptor.key !== observerBackend) {
    return {
      ok: false,
      reason: 'LIVE_CAPABILITY_DESCRIPTOR_KEY_MISMATCH',
      descriptor,
      descriptor_hash: descriptorHash,
    };
  }
  if (!descriptor.evidence_source?.trim()) {
    return {
      ok: false,
      reason: 'LIVE_CAPABILITY_DESCRIPTOR_EVIDENCE_MISSING',
      descriptor,
      descriptor_hash: descriptorHash,
    };
  }
  const missingCapabilities = MINIMUM_LIVE_CAPABILITY_FLAGS.filter((field) => !descriptor[field]);
  if (missingCapabilities.length > 0) {
    return {
      ok: false,
      reason: 'LIVE_CAPABILITY_DESCRIPTOR_INSUFFICIENT',
      descriptor,
      descriptor_hash: descriptorHash,
      missing_capabilities: missingCapabilities,
    };
  }
  return { ok: true, descriptor, descriptor_hash: descriptorHash };
};

export const buildLiveCapabilityAuditDetail = (input: {
  observer_backend: string;
  phase: 'upsert' | 'boot';
  validation: LiveCapabilityValidationResult;
}) => ({
  observer_backend: input.observer_backend,
  phase: input.phase,
  validator_result: input.validation.ok ? 'ok' : input.validation.reason,
  descriptor_hash: input.validation.descriptor_hash,
  evidence_source: input.validation.descriptor?.evidence_source,
  descriptor: input.validation.descriptor
    ? {
        key: input.validation.descriptor.key,
        supports_submit: input.validation.descriptor.supports_submit,
        supports_cancel_by_external_operate_order_id:
          input.validation.descriptor.supports_cancel_by_external_operate_order_id,
        supports_closed_order_history: input.validation.descriptor.supports_closed_order_history,
        supports_open_orders: input.validation.descriptor.supports_open_orders,
        supports_account_snapshot: input.validation.descriptor.supports_account_snapshot,
        supports_authorize_order_account_check:
          input.validation.descriptor.supports_authorize_order_account_check,
      }
    : undefined,
  missing_capabilities: input.validation.ok ? undefined : input.validation.missing_capabilities,
});
