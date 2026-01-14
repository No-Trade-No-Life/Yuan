import type { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { buildAsgTerminationCard } from './format';

export type AutoScalingTerminationEvent = {
  source: string;
  'detail-type': string;
  account?: string;
  region?: string;
  time?: string;
  detail?: {
    AutoScalingGroupName?: string;
    EC2InstanceId?: string;
    Cause?: string;
    LifecycleHookName?: string;
  };
};

const SUPPORTED_DETAIL_TYPES = new Set([
  'EC2 Instance Terminate Successful',
  'EC2 Instance Terminate Unsuccessful',
]);

const parseBooleanEnv = (value: string | undefined) => value === 'true' || value === '1';

const parseAsgNames = (value: string | undefined) =>
  new Set(
    (value ?? '')
      .split(';')
      .map((name) => name.trim())
      .filter(Boolean),
  );

const isStatusChecksFailure = (cause: string | undefined) =>
  (cause ?? '').toLowerCase().includes('status checks failure');

const shouldProcessEvent = (event: AutoScalingTerminationEvent) => {
  if (event.source !== 'aws.autoscaling') {
    return { ok: false, reason: 'source-mismatch' };
  }
  if (!SUPPORTED_DETAIL_TYPES.has(event['detail-type'])) {
    return { ok: false, reason: 'detail-type-mismatch' };
  }

  const allowedAsgNames = parseAsgNames(process.env.ASG_NAMES);
  const asgName = event.detail?.AutoScalingGroupName;
  if (allowedAsgNames.size > 0 && (!asgName || !allowedAsgNames.has(asgName))) {
    return { ok: false, reason: 'asg-name-mismatch' };
  }

  if (parseBooleanEnv(process.env.STATUS_CHECKS_ONLY) && !isStatusChecksFailure(event.detail?.Cause)) {
    return { ok: false, reason: 'status-checks-only' };
  }

  return { ok: true };
};

export const handleAsgEvent = async (terminal: Terminal, event: AutoScalingTerminationEvent) => {
  const check = shouldProcessEvent(event);
  if (!check.ok) {
    console.info(formatTime(Date.now()), 'ASGEventSkipped', check.reason, event['detail-type']);
    return { notified: false, reason: check.reason };
  }

  const receiverId = process.env.FEISHU_RECEIVER_ID;
  if (!receiverId) {
    return { notified: false, reason: 'feishu-receiver-missing' };
  }

  const card = buildAsgTerminationCard(event);
  const payload = {
    receive_id: receiverId,
    receive_id_type: 'chat_id',
    msg_type: 'interactive',
    content: JSON.stringify(card),
  };

  const result = await terminal.client.requestForResponse<typeof payload, { message_id: string }>(
    'Feishu/SendMessage',
    payload,
  );

  if (result.code !== 0) {
    throw new Error(`SendFeishuCardFailed: ${result.message}`);
  }

  return { notified: true };
};
