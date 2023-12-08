## promjs

A Prometheus metrics registry implemented in TypeScript

Notice: Forked from [promjs](https://github.com/weaveworks/promjs) to optimize the performance of the library.

### Goals

- Stick to [Prometheus client best practices](https://prometheus.io/docs/instrumenting/writing_clientlibs/) as closely as possible
- Run in Node.js or the browser
- Fit into the modern JavaScript ecosystem
- Minimally rely on third-party dependencies

### Installation

Install via `npm`:

`$ npm install --save promjs`

or via `yarn`:

`$ yarn add promjs`

### Usage

```javascript
// Using es6 imports
import prom from 'promjs';
// Using CommonJS
const prom = require('promjs');

const registry = prom();
const pageRequestCounter = registry.create('counter', 'page_requests', 'A counter for page requests');

pageRequestCounter.inc();
console.log(registry.metrics());
// =>
// # HELP page_requests A counter for page requests \n
// # TYPE page_requests counter
// page_requests 1 \n
```

### API

#### prom()

Returns a registry class.

### Registry

#### registry.create(type, name, help) => collector (_counter | gauge | histogram_)

Returns a metric class of the specified type. The metric is already registered with the registry that creates it.

Arguments

1. `type` (_String_): The type of metric to create. The current supported types are `counter`, `gauge`, and `histogram`.
2. `name` (_String_): The name of the metric
3. `help` (_String_): The help message for the metric

Example

```javascript
import prom from 'promjs';

const registry = prom();
const counter = registry.create('counter', 'my_counter', 'A counter for things');
```

#### registry.metrics() => string

Returns a prometheus formatted string containing all existing metrics.

```javascript
const counter = registry.create('counter', 'my_counter', 'A counter for things');
counter.inc();
console.log(registry.metrics());
// =>
// # HELP my_counter A counter for things \n
// # TYPE my_counter counter
// my_counter 1 \n
```

#### registry.clear() => self

Removes all metrics from internal `data` storage. Returns itself to allow for chaining.

#### registry.reset() => self

Resets all existing metrics to 0. This can be used to reset metrics after reporting to a prometheus aggregator. Returns itself to allow for chaining.

#### registry.get(type, name) => collector (_counter | gauge | histogram_) | null

Fetches an existing metric by name. Returns null if no metrics are found

### Collector

All of the metric classes (Counter, Gauge, Histogram) inherit from the Collector class. Collector methods are available on each of the metic classes.

#### collector.reset([labels]) => self

Resets metrics in the collector. Optionally pass in labels to reset only those labels.

#### collector.resetAll() => self

Resets all metrics in the collector, including metrics with labels.

### Counter

A counter can only ever be incremented positively.

#### counter.inc([labels]) => self

Increments a counter. Optionally pass in a set of labels to increment only those labels.

#### counter.add(amount, [labels]) => self

Increments a counter by a given amount. `amount` must be a Number. Optionally pass in a set of labels to increment only those labels.

```javascript
const counter = registry.create('counter', 'my_counter', 'A counter for things');
counter.inc();
counter.add(2, { ok: true, status: 'success', code: 200 });
counter.add(2, { ok: false, status: 'fail', code: 403 });

console.log(registry.metrics());
// =>
// # HELP my_counter A counter for things
// # TYPE my_counter counter
// my_counter 1
// my_counter{ok="true",status="success",code="200"} 2
// my_counter{ok="false",status="fail",code="403"} 2
```

### Gauge

A gauge is similar to a counter, but can be incremented up and down.

#### gauge.inc([labels]) => self

Increments a gauge by 1.

#### gauge.dec([lables]) => self

Decrements a gauge by 1.

#### gauge.add(amount, [lables]) => self

Increments a gauge by a given amount. `amount` must be a Number.

#### gauge.sub(amount, [labels]) => self

Decrements a gauge by a given amount.

```javascript
const gauge = registry.create('gauge', 'my_gauge', 'A gauge for stuffs');
gauge.inc();
gauge.inc({ instance: 'some_instance' });
gauge.dec({ instance: 'some_instance' });
gauge.add(100, { instance: 'some_instance' });
gauge.sub(50, { instance: 'some_instance' });

console.log(registry.metrics());
// =>
// # HELP my_gauge A gauge for stuffs
// # TYPE my_gauge gauge
// my_gauge 1
// my_gauge{instance="some_instance"} 50
```

### Histogram

Histograms are used to group values into pre-defined buckets. Buckets are passed in to the `registry.create()` call.

#### histogram.observe(value) => self

Adds `value` to a pre-existing bucket.`value` must be a number.

```javascript
const histogram = registry.create('histogram', 'response_time', 'The response time', [200, 300, 400, 500]);
histogram.observe(299);
histogram.observe(253, { path: '/api/users', status: 200 });
histogram.observe(499, { path: '/api/users', status: 200 });

console.log(registry.metrics());
// =>
// # HELP response_time The response time
// # TYPE response_time histogram
// response_time_count 3
// response_time_sum 599
// response_time_bucket{le="200"} 1
// response_time_bucket{le="400",path="/api/users",status="200"} 1
// response_time_bucket{le="200",path="/api/users",status="200"} 1
```

## <a name="help"></a>Getting Help

If you have any questions about, feedback for or problems with `promjs`:

- Invite yourself to the <a href="https://slack.weave.works/" target="_blank">Weave Users Slack</a>.
- Ask a question on the [#general](https://weave-community.slack.com/messages/general/) slack channel.
- [File an issue](https://github.com/weaveworks/promjs/issues/new).

Weaveworks follows the [CNCF Code of Conduct](https://github.com/cncf/foundation/blob/master/code-of-conduct.md). Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting a Weaveworks project maintainer, or Alexis Richardson (alexis@weave.works).

Your feedback is always welcome!
