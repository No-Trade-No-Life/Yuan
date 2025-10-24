# @yuants/prometheus

This package implements a high-performance, cross-platform Prometheus metrics library for modern JavaScript applications.

## Features

- 🚀 **High Performance**: Uses currying to pre-calculate label keys, minimizing runtime overhead
- 🌐 **Cross-Platform**: Compatible with Browser / NodeJS / various JavaScript environments, using only standard JS features
- 🏷️ **Curried Labels**: Caches label concatenation strings between multiple metric value settings
- 📊 **Complete Metric Types**: Supports Counter, Gauge, and Histogram standard Prometheus metrics
- 🔧 **Flexible Management**: Supports registry management, data deletion, reset, and serialization

## Installation

```bash
npm install @yuants/prometheus
```

## Quick Start

### Basic Usage

```typescript
import { createRegistry } from '@yuants/prometheus';

// Create registry
const registry = createRegistry();

// Create counter
const requests = registry.counter('http_requests', 'Total HTTP requests');
requests.inc(); // Increment by 1
requests.add(5); // Add 5

// Create gauge
const memory = registry.gauge('memory_usage', 'Memory usage in bytes');
memory.set(1024 * 1024); // Set value
memory.inc(); // Increment by 1
memory.dec(); // Decrement by 1

// Create histogram
const latency = registry.histogram('latency_seconds', 'Request latency', [0.1, 0.5, 1.0]);
latency.observe(0.05);
latency.observe(0.3);

// Serialize output
console.log(registry.serialize());
```

### Using Labels

```typescript
const requests = registry.counter('http_requests', 'HTTP requests');

// Use labels
const getRequests = requests.labels({ method: 'GET', status: '200' });
const postRequests = requests.labels({ method: 'POST', status: '201' });

getRequests.inc(100);
postRequests.inc(50);

// Curried label chaining
const apiRequests = requests
  .labels({ service: 'api' })
  .labels({ version: 'v1' })
  .labels({ environment: 'production' });

apiRequests.inc(25);
```

### Data Management

```typescript
// Delete data for specific label combination
registry.delete('http_requests', { method: 'GET', status: '200' });

// Delete all http_requests data
registry.delete('http_requests');

// Clear all data
registry.clear();

// Reset all data to initial values
registry.reset();
```

## API Documentation

### Registry

#### `createRegistry(): IRegistry`

Create a new metrics registry.

#### `registry.counter(name: string, help: string): Counter`

Create and register a counter.

#### `registry.gauge(name: string, help: string): Gauge`

Create and register a gauge.

#### `registry.histogram(name: string, help: string, buckets?: number[]): Histogram`

Create and register a histogram. If buckets are not provided, default buckets are used: `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`

#### `registry.delete(name: string, labels?: Record<string, string>): void`

Delete data for a specific metric.

#### `registry.clear(): void`

Clear all data.

#### `registry.reset(): void`

Reset all data to initial values.

#### `registry.serialize(): string`

Serialize all metrics to Prometheus text format.

### Counter

#### `counter.inc(value = 1): void`

Increment counter value.

#### `counter.add(value: number): void`

Add specified value (must be >= 0).

#### `counter.set(value: number): void`

Set counter value.

#### `counter.get(): number`

Get current value.

#### `counter.delete(): void`

Delete data for this label combination.

#### `counter.labels(labelObj: Labels): Counter`

Return a counter instance with new labels.

### Gauge

#### `gauge.inc(value = 1): void`

Increment gauge value.

#### `gauge.dec(value = 1): void`

Decrement gauge value.

#### `gauge.add(value: number): void`

Add specified value.

#### `gauge.sub(value: number): void`

Subtract specified value.

#### `gauge.set(value: number): void`

Set gauge value.

#### `gauge.get(): number`

Get current value.

#### `gauge.delete(): void`

Delete data for this label combination.

#### `gauge.labels(labelObj: Labels): Gauge`

Return a gauge instance with new labels.

### Histogram

#### `histogram.observe(value: number): void`

Observe a value and update the histogram.

#### `histogram.get(): HistogramData`

Get histogram data.

#### `histogram.delete(): void`

Delete data for this label combination.

#### `histogram.labels(labelObj: Labels): Histogram`

Return a histogram instance with new labels.

## Performance Characteristics

### Label Key Pre-calculation

```typescript
// Pre-calculate at creation time to avoid runtime recalculation
const makeLabelKey = (name: string, labels: Labels): string => {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
};
```

### Currying Performance Benefits

```typescript
// Traditional approach - labels need to be recalculated each time
counter.inc({ method: 'GET', status: '200' }, 1);
counter.inc({ method: 'GET', status: '200' }, 1);

// Curried approach - label key pre-calculated at creation time
const getCounter = counter.labels({ method: 'GET', status: '200' });
getCounter.inc(1); // Fast operation, label key cached
getCounter.inc(1); // Fast operation again
```

## Serialization Format

The library outputs standard Prometheus text format:

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100
http_requests_total{method="POST",status="201"} 50

# HELP latency_seconds Request latency
# TYPE latency_seconds histogram
latency_seconds_count 3
latency_seconds_sum 1.15
latency_seconds_bucket{le="0.1"} 1
latency_seconds_bucket{le="0.5"} 2
latency_seconds_bucket{le="1.0"} 3
latency_seconds_bucket{le="+Inf"} 3
```

## Testing

Run tests:

```bash
npm run build
```

## License

MIT
