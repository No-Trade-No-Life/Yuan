import { formatTime } from '@yuants/utils';
import type { AutoScalingTerminationEvent } from './handler';

const DEFAULT_MARGIN = '0px 0px 0px 0px';

const buildField = (label: string, value: string) => ({
  tag: 'markdown',
  content: `<font color="grey">${label}</font>\n${value}`,
  text_align: 'left',
  text_size: 'normal_v2',
  margin: DEFAULT_MARGIN,
});

const buildColumnSet = (left: ReturnType<typeof buildField>, right: ReturnType<typeof buildField>) => ({
  tag: 'column_set',
  horizontal_spacing: '8px',
  horizontal_align: 'left',
  columns: [
    {
      tag: 'column',
      width: 'weighted',
      elements: [left],
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      weight: 1,
    },
    {
      tag: 'column',
      width: 'weighted',
      elements: [right],
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      weight: 1,
    },
  ],
  margin: DEFAULT_MARGIN,
});

export const buildAsgTerminationCard = (event: AutoScalingTerminationEvent) => {
  const detail = event.detail ?? {};
  const detailType = event['detail-type'];
  const isUnsuccessful = detailType === 'EC2 Instance Terminate Unsuccessful';
  const statusLabel = isUnsuccessful ? '终止失败' : '终止成功';
  const eventTime = event.time ?? Date.now();
  const utcTime = formatTime(eventTime, 'UTC');
  const jstTime = formatTime(eventTime, 'Asia/Tokyo');

  const asgName = detail.AutoScalingGroupName ?? 'unknown';
  const instanceId = detail.EC2InstanceId ?? 'unknown';
  const lifecycleHook = detail.LifecycleHookName ?? 'None';
  const cause = detail.Cause ?? 'None';
  const region = event.region ?? 'unknown';
  const accountId = event.account ?? 'unknown';

  return {
    schema: '2.0',
    config: {
      update_multi: true,
      style: {
        text_size: {
          normal_v2: {
            default: 'normal',
            pc: 'normal',
            mobile: 'heading',
          },
        },
      },
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `${statusLabel} - ASG Terminate`,
      },
      subtitle: {
        tag: 'plain_text',
        content: detailType,
      },
      template: isUnsuccessful ? 'red' : 'blue',
      icon: {
        tag: 'standard_icon',
        token: isUnsuccessful ? 'warning-hollow_filled' : 'success-hollow_filled',
      },
      padding: '12px 12px 12px 12px',
    },
    body: {
      direction: 'vertical',
      horizontal_spacing: '8px',
      vertical_spacing: '8px',
      horizontal_align: 'left',
      vertical_align: 'top',
      padding: '12px 12px 12px 12px',
      elements: [
        buildColumnSet(buildField('AutoScalingGroupName', asgName), buildField('EC2InstanceId', instanceId)),
        buildColumnSet(buildField('LifecycleHookName', lifecycleHook), buildField('Region', region)),
        buildColumnSet(
          buildField('AccountId', accountId),
          buildField('EventTime', `${utcTime} / ${jstTime}`),
        ),
        {
          tag: 'markdown',
          content: `**Cause**\n${cause}`,
          text_align: 'left',
          text_size: 'normal_v2',
          margin: DEFAULT_MARGIN,
        },
      ],
    },
  } as const;
};
