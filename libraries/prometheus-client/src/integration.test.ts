import prom from '.';
import { Registry } from './registry';

describe('promjs', () => {
  // e2e Test
  let actual: string;
  let registry: Registry;
  let desired: string[];
  let errors: string[];

  beforeEach(() => {
    desired = [];
    registry = prom();
    errors = [];
    const counter = registry.create('counter', 'my_counter', 'A counter for things');
    const gauge = registry.create('gauge', 'my_gauge', 'A gauge for stuffs');
    const histogram = registry.create(
      'histogram',
      'response_time',
      'The response time',
      [200, 300, 400, 500],
    );

    desired.push('# HELP my_counter A counter for things\n');
    desired.push('# TYPE my_counter counter\n');
    counter.inc();
    desired.push('my_counter 1\n');

    counter.add(2, { ok: 'true', status: 'success', code: 200 });
    counter.add(2, { ok: 'false', status: 'fail', code: 403 });
    desired.push('my_counter{ok="true",status="success",code="200"} 2\n');
    desired.push('my_counter{ok="false",status="fail",code="403"} 2\n');

    desired.push('# HELP my_gauge A gauge for stuffs\n');
    desired.push('# TYPE my_gauge gauge\n');
    gauge.inc();
    desired.push('my_gauge 1\n');

    gauge.inc({ instance: 'some_instance' });
    gauge.dec({ instance: 'some_instance' });
    gauge.add(100, { instance: 'some_instance' });
    gauge.sub(50, { instance: 'some_instance' });
    desired.push('my_gauge{instance="some_instance"} 50\n');

    desired.push('# HELP response_time The response time');
    desired.push('# TYPE response_time histogram');
    histogram.observe(299);
    histogram.observe(300);
    desired.push('response_time_count 2\n');
    desired.push('response_time_sum 599\n');
    desired.push('response_time_bucket{le="200"} 0\n');
    desired.push('response_time_bucket{le="300"} 2\n');
    desired.push('response_time_bucket{le="400"} 2\n');
    desired.push('response_time_bucket{le="500"} 2\n');
    desired.push('response_time_bucket{le="+Inf"} 2\n');

    histogram.observe(401, { path: '/api/users', status: 200 });
    histogram.observe(253, { path: '/api/users', status: 200 });
    histogram.observe(499, { path: '/api/users', status: 200 });
    histogram.observe(700, { path: '/api/users', status: 200 });
    desired.push('response_time_bucket{le="200",path="/api/users",status="200"} 0\n');
    desired.push('response_time_bucket{le="300",path="/api/users",status="200"} 1\n');
    desired.push('response_time_bucket{le="400",path="/api/users",status="200"} 1\n');
    desired.push('response_time_bucket{le="500",path="/api/users",status="200"} 3\n');
    desired.push('response_time_bucket{le="+Inf",path="/api/users",status="200"} 4\n');

    actual = registry.metrics();
  });

  it('reports metrics', () => {
    for (let i = 0; i < desired.length; i += 1) {
      const d = desired[i];
      if (!actual.includes(d)) {
        errors.push(`Actual: ${actual}\nExpected: ${d}`);
      }
    }

    expect(errors).toEqual([]);
  });

  it('clear all metrics', () => {
    const cleared = registry.reset().metrics().split('\n');

    // Check that the end of each metric string is a 0
    expect(cleared.length).toBeGreaterThan(5);
    for (let i = 0; i < cleared.length; i += 1) {
      const m = cleared[i];
      if (m && !m.includes('TYPE') && !m.includes('HELP')) {
        expect(m.slice(-1)).toBe('0');
      }
    }
  });
});
