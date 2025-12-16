import { useObservable, useObservableState } from 'observable-hooks';
import { defer, map, mergeWith, of, repeat, retry, switchMap, tap } from 'rxjs';
import { DataView, InlineNumber, InlineTime } from '../Interactive';
import { terminal$ } from '../Network';
import { registerPage } from '../Pages';
import { formatTime } from '@yuants/utils';
import { Typography } from '@douyinfe/semi-ui';
interface IAlert {
  state: string;
  labels: {
    [key: string]: string;
  };
  annotations: {
    [key: string]: string;
  };
  activeAt: string;
  value: string;
}

interface INormalizedAlert {
  name: string;
  state: string;
  severity: string;
  active_at: string;
  summary: string;
  description: string;
  runbook_url: string;
  value: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

const normalizeAlert = (alert: IAlert): INormalizedAlert => {
  const { alertname, severity, ...otherLabels } = alert.labels;
  const { summary, description, runbook_url, ...otherAnnotations } = alert.annotations;
  return {
    name: alertname,
    state: alert.state,
    severity: severity,
    active_at: formatTime(alert.activeAt),
    summary,
    description,
    value: alert.value,
    runbook_url,
    labels: otherLabels,
    annotations: otherAnnotations,
  };
};

registerPage('AlertList', () => {
  const alertList = useObservableState(
    useObservable(() =>
      terminal$.pipe(
        switchMap((terminal) =>
          terminal
            ? defer(() =>
                terminal.client.requestForResponseData<
                  {},
                  {
                    data: {
                      alerts: IAlert[];
                    };
                  }
                >('prometheus/alerts', {}),
              ).pipe(
                //
                // tap((x) => console.log('alerts', x)),
                map((res) => res.data.alerts.map(normalizeAlert)),
                repeat({ delay: 5000 }),
                retry({ delay: 5000 }),
                mergeWith(of(undefined)),
              )
            : of([]),
        ),
      ),
    ),
  );

  return (
    <DataView
      data={alertList}
      initialSorting={[
        {
          id: 'active_at',
          desc: true,
        },
      ]}
      columns={[
        //
        { header: '报警名', accessorKey: 'name' },
        { header: '状态', accessorKey: 'state' },
        { header: '严重性', accessorKey: 'severity' },
        { header: '开始时间', accessorKey: 'active_at', cell: (x) => <InlineTime time={x.getValue()} /> },
        { header: '值', accessorKey: 'value', cell: (x) => <InlineNumber number={x.getValue()} /> },
        { header: '摘要', accessorKey: 'summary' },
        { header: '描述', accessorKey: 'description' },
        {
          header: 'Runbook',
          accessorKey: 'runbook_url',
          cell: (x) => (
            <Typography.Text link={{ href: x.getValue(), target: '_blank' }}>{x.getValue()}</Typography.Text>
          ),
        },
        {
          header: '标签',
          accessorKey: 'labels',
          cell: (x) => JSON.stringify(x.getValue()),
        },
        {
          header: '注解',
          accessorKey: 'annotations',
          cell: (x) => JSON.stringify(x.getValue()),
        },
      ]}
    />
  );
});
