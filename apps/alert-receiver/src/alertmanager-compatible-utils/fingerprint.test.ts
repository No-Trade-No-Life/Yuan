import { computeAlertFingerprint } from './fingerprint';

// Example Alertmanager webhook payload for reference:
// {
//   "receiver": "yuan",
//   "status": "firing",
//   "alerts": [
//     {
//       "status": "firing",
//       "labels": {
//         "alertname": "Watchdog",
//         "prometheus": "monitoring/k8s",
//         "severity": "none"
//       },
//       "annotations": {
//         "description": "This is an alert meant to ensure that the entire alerting pipeline is functional.\nThis alert is always firing, therefore it should always be firing in Alertmanager\nand always fire against a receiver. There are integrations with various notification\nmechanisms that send a notification when this alert is not firing. For example the\n\"DeadMansSnitch\" integration in PagerDuty.\n",
//         "runbook_url": "https://runbooks.prometheus-operator.dev/runbooks/general/watchdog",
//         "summary": "An alert that should always be firing to certify that Alertmanager is working properly."
//       },
//       "startsAt": "2025-07-03T04:06:53.276Z",
//       "endsAt": "0001-01-01T00:00:00Z",
//       "generatorURL": "http://prometheus-k8s-0:9090/graph?g0.expr=vector%281%29\u0026g0.tab=1",
//       "fingerprint": "e1749c6acab64267"
//     }
//   ],
//   "groupLabels": { "alertname": "Watchdog", "severity": "none" },
//   "commonLabels": {
//     "alertname": "Watchdog",
//     "prometheus": "monitoring/k8s",
//     "severity": "none"
//   },
//   "commonAnnotations": {
//     "description": "This is an alert meant to ensure that the entire alerting pipeline is functional.\nThis alert is always firing, therefore it should always be firing in Alertmanager\nand always fire against a receiver. There are integrations with various notification\nmechanisms that send a notification when this alert is not firing. For example the\n\"DeadMansSnitch\" integration in PagerDuty.\n",
//     "runbook_url": "https://runbooks.prometheus-operator.dev/runbooks/general/watchdog",
//     "summary": "An alert that should always be firing to certify that Alertmanager is working properly."
//   },
//   "externalURL": "http://alertmanager-main-0:9093",
//   "version": "4",
//   "groupKey": "{}/{alertname=\"Watchdog\"}:{alertname=\"Watchdog\", severity=\"none\"}",
//   "truncatedAlerts": 0
// }

describe('computeAlertFingerprint', () => {
  it('matches Alertmanager for Watchdog example', () => {
    const labels = {
      alertname: 'Watchdog',
      prometheus: 'monitoring/k8s',
      severity: 'none',
    } as Record<string, string>;

    // From provided Alertmanager webhook JSON
    const expected = 'e1749c6acab64267';
    expect(computeAlertFingerprint(labels)).toBe(expected);
  });

  it('is independent of label order', () => {
    const labelsA = {
      alertname: 'Watchdog',
      prometheus: 'monitoring/k8s',
      severity: 'none',
    } as Record<string, string>;
    const labelsB = {
      severity: 'none',
      alertname: 'Watchdog',
      prometheus: 'monitoring/k8s',
    } as Record<string, string>;

    expect(computeAlertFingerprint(labelsA)).toBe(computeAlertFingerprint(labelsB));
  });
});
