import type { IAlertGroup } from '../types';
import { computeGroupSeverity } from '../utils';

const MAX_ALERT_ITEMS = 30; // 避免超过 Feishu 2.0 卡片 200 元素上限

export const renderAlertMessageCard = (group: IAlertGroup) => {
  const margin = '0px 0px 0px 0px';
  const severity = computeGroupSeverity(group.alerts);
  const visibleAlerts = group.alerts.slice(0, MAX_ALERT_ITEMS);
  const hiddenCount = Math.max(group.alerts.length - visibleAlerts.length, 0);
  const detailElements = visibleAlerts.map((alert, index) => {
    const isFiring = alert.status === 'firing';
    const endTime =
      alert.end_time ??
      (isFiring
        ? '仍在告警'
        : alert.end_time === undefined || alert.end_time === null
        ? '已解决'
        : alert.end_time);
    const prefix = `${index + 1}. ${isFiring ? '[告警中]' : '[已解决]'}`;
    const summary = alert.summary ?? alert.description ?? 'No description';
    return {
      tag: 'markdown',
      content: `${prefix} ${alert.start_time} → ${endTime}\n${summary}`,
      text_align: 'left',
      text_size: 'normal_v2',
      margin,
    };
  });

  return {
    name: '告警发起',
    dsl: {
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
      body: {
        direction: 'vertical',
        horizontal_spacing: '8px',
        vertical_spacing: '8px',
        horizontal_align: 'left',
        vertical_align: 'top',
        padding: '12px 12px 12px 12px',
        elements: [
          {
            tag: 'column_set',
            horizontal_spacing: '8px',
            horizontal_align: 'left',
            columns: [
              {
                tag: 'column',
                width: 'weighted',
                elements: [
                  {
                    tag: 'markdown',
                    content: `<font color="grey">告警等级</font>\n${severity}`,
                    text_align: 'left',
                    text_size: 'normal_v2',
                    margin,
                  },
                ],
                vertical_spacing: '8px',
                horizontal_align: 'left',
                vertical_align: 'top',
                weight: 1,
              },
              {
                tag: 'column',
                width: 'weighted',
                elements: [
                  {
                    tag: 'markdown',
                    content: `<font color="grey">告警环境</font> \n${group.alerts[0]?.env ?? 'unknown'}`,
                    text_align: 'left',
                    text_size: 'normal_v2',
                    margin,
                  },
                ],
                vertical_spacing: '8px',
                horizontal_align: 'left',
                vertical_align: 'top',
                weight: 1,
              },
            ],
            margin,
          },
          {
            tag: 'column_set',
            horizontal_spacing: '8px',
            horizontal_align: 'left',
            columns: [
              {
                tag: 'column',
                width: 'weighted',
                elements: [
                  {
                    tag: 'markdown',
                    content: `<font color="grey">告警内容</font>${
                      group.alerts[0]?.summary
                        ? `\n${group.alerts[0]?.summary}\n共 ${group.alerts.length} 条告警`
                        : ''
                    }`,
                    text_align: 'left',
                    text_size: 'normal_v2',
                    margin,
                  },
                ],
                vertical_spacing: '8px',
                horizontal_align: 'left',
                vertical_align: 'top',
                weight: 1,
              },
            ],
            margin,
          },
          {
            tag: 'column_set',
            horizontal_spacing: '8px',
            horizontal_align: 'left',
            columns: [
              {
                tag: 'column',
                width: 'weighted',
                elements: [
                  {
                    tag: 'markdown',
                    content: `<font color="grey">预案链接</font>：${group.alerts[0]?.runbook_url ?? 'None'}`,
                    text_align: 'left',
                    text_size: 'normal_v2',
                    margin,
                  },
                ],
                vertical_spacing: '8px',
                horizontal_align: 'left',
                vertical_align: 'top',
                weight: 1,
              },
            ],
            margin,
          },
          {
            tag: 'markdown',
            content: '**详情列表：**',
            text_align: 'left',
            text_size: 'normal_v2',
            margin,
          },
          ...detailElements,
          ...(hiddenCount > 0
            ? [
                {
                  tag: 'markdown',
                  content: `其余 ${hiddenCount} 条已隐藏，查看 Runbook 或链接获取完整列表。`,
                  text_align: 'left',
                  text_size: 'normal_v2',
                  margin,
                },
              ]
            : []),
        ],
      },
      header: {
        title: {
          tag: 'plain_text',
          content: `${
            group.status === 'Firing'
              ? '[告警中]'
              : group.status === 'PartialResolved'
              ? '[部分解决]'
              : '[已解决]'
          } 告警通知：${group.alert_name}`,
        },
        subtitle: {
          tag: 'plain_text',
          content: '',
        },
        template: group.status === 'Firing' ? 'red' : group.status === 'PartialResolved' ? 'yellow' : 'blue',
        icon: {
          tag: 'standard_icon',
          token: group.status === 'Resolved' ? 'success-hollow_filled' : 'warning-hollow_filled',
        },
        padding: '12px 12px 12px 12px',
      },
    },
  } as const;
};
