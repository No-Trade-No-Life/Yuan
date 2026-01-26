## What

Add a new `@yuants/http-services` package that provides an HTTP Proxy Service with label-based routing and safe fetch execution.

## Why

We need a unified, controllable proxy layer for outbound HTTP requests across Terminal nodes, with consistent routing and observability.

## How

- Server: `provideHTTPProxyService` registers a JSON Schema route, validates URLs, enforces `allowedHosts`, and limits response body size.
- Errors: throw `newError` / `scopeError` and rely on Terminal Server to map responses.
- Client: `requestHTTPProxy` wraps `terminal.client.requestForResponse` with typed request/response.
- Supporting assets: types, benchmarks, tests, and API report.

## Testing

- `rush build -t @yuants/http-services`
  - Result: success with Jest open-handles warning (worker force-exit)

## Risk / Rollback

- Risk: Open proxy if `allowedHosts` is unset; added latency due to proxy hop.
- Rollback: Stop registering `HTTPProxy` services or revert `libraries/http-services` changes.

## Links

- RFC: `../docs/rfc.md`
- Specs: `../docs/spec-dev.md`, `../docs/spec-test.md`, `../docs/spec-bench.md`, `../docs/spec-obs.md`
- Walkthrough: `./report-walkthrough.md`
