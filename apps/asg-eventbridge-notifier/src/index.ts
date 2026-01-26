import { Terminal } from '@yuants/protocol';
import type { AutoScalingTerminationEvent } from './handler';
import { handleAsgEvent } from './handler';
import { JSONSchema7 } from 'json-schema';

const terminal = Terminal.fromNodeEnv();

const schema: JSONSchema7 = {
  type: 'object',
  required: ['source', 'detail-type', 'detail'],
  properties: {
    source: { type: 'string', const: 'aws.autoscaling' },
    'detail-type': {
      type: 'string',
      enum: ['EC2 Instance Terminate Successful', 'EC2 Instance Terminate Unsuccessful'],
    },
    account: { type: 'string' },
    region: { type: 'string' },
    time: { type: 'string' },
    detail: {
      type: 'object',
      required: ['AutoScalingGroupName'],
      properties: {
        AutoScalingGroupName: { type: 'string' },
        EC2InstanceId: { type: 'string' },
        Cause: { type: 'string' },
        LifecycleHookName: { type: 'string' },
      },
    },
  },
};

type AutoScalingEventResponse = {
  notified: boolean;
  reason?: string;
};

terminal.server.provideService<AutoScalingTerminationEvent, AutoScalingEventResponse>(
  'AWS/AutoScalingEvent',
  schema,
  async (msg) => {
    const data = await handleAsgEvent(terminal, msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);
