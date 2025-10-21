import type { IAlertGroup } from '../types';

/**
 * Render alert group into Feishu interactive card payload.
 */
const SEVERITY_ORDER = ['UNKNOWN', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'] as const;
const getSeverityIndex = (value: string) => SEVERITY_ORDER.indexOf(value as (typeof SEVERITY_ORDER)[number]);

export const renderAlertMessageCard = (group: IAlertGroup) => {
  const margin = '0px 0px 0px 0px';
  const severity = group.alerts.reduce<string>((prev, alert) => {
    const prevIndex = getSeverityIndex(prev);
    const currentIndex = getSeverityIndex(alert.severity);
    if (currentIndex === -1) return prev;
    if (prevIndex === -1 || currentIndex < prevIndex) return alert.severity;
    return prev;
  }, 'INFO');
  const detailElements = group.alerts.flatMap((alert) => {
    const isFiring = alert.status === 'firing';
    const endTime =
      alert.end_time ??
      (isFiring
        ? '仍在告警'
        : alert.end_time === undefined || alert.end_time === null
        ? '已解决'
        : alert.end_time);
    return [
      { tag: 'hr', margin },
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
                content: `<font color="grey">当前状态</font>：<font color="${isFiring ? 'red' : 'green'}">${
                  isFiring ? '告警中' : '已解决'
                }</font>`,
                text_align: 'left',
                text_size: 'normal_v2',
                margin,
              },
            ],
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
                content: `<font color="grey">告警时间</font>\n${alert.start_time}`,
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
                content: `<font color="grey">结束时间</font>\n${endTime}`,
                text_align: 'left',
                text_size: 'normal_v2',
                margin,
              },
            ],
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
                content: `<font color="grey">告警详情</font>：${alert.description ?? 'No description'}`,
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
                content: `<font color="grey">当前值</font>：${alert.current_value ?? 'N/A'}`,
                text_align: 'left',
                text_size: 'normal_v2',
                margin,
              },
            ],
            vertical_align: 'top',
            weight: 1,
          },
        ],
        margin,
      },
      { tag: 'hr', margin },
    ];
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
                    content: `<font color="grey">告警内容</font>\n共 ${group.alerts.length} 条告警`,
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
