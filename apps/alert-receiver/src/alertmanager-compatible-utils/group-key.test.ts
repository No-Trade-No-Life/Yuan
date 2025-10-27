import { computeAlertGroupKey, formatGroupLabels, formatRouteKey } from './group-key';

describe('group key helpers', () => {
  it('formats group labels like Prometheus LabelSet.String()', () => {
    const labels = {
      severity: 'none',
      alertname: 'Watchdog',
    };
    expect(formatGroupLabels(labels)).toBe('{alertname="Watchdog", severity="none"}');
  });

  it('formats route segments like Alertmanager Route.Key()', () => {
    const routeSegments = [
      [],
      [
        {
          name: 'alertname',
          value: 'Watchdog',
          operator: '=',
        },
      ],
    ] as const;
    expect(formatRouteKey(routeSegments)).toBe('{}/{alertname="Watchdog"}');
  });

  it('computes group key identical to Alertmanager', () => {
    const routeSegments = [
      [],
      [
        {
          name: 'alertname',
          value: 'Watchdog',
          operator: '=',
        },
      ],
    ] as const;
    const labels = {
      alertname: 'Watchdog',
      severity: 'none',
    };

    expect(computeAlertGroupKey(routeSegments, labels)).toBe(
      '{}/{alertname="Watchdog"}:{alertname="Watchdog", severity="none"}',
    );
  });

  it('accepts precomputed routeKey string', () => {
    const labels = {
      alertname: 'Watchdog',
      severity: 'none',
    };
    expect(computeAlertGroupKey('{}', labels)).toBe('{}:{alertname="Watchdog", severity="none"}');
  });
});
