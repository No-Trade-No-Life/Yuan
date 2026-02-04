## What

- Add target host/path metrics for HTTP proxy requests in `@yuants/http-services`

## Why

- Provide visibility into downstream target distribution and error patterns per host/path

## How

- Register `http_proxy_target_host_requests_total` with `target_host`, `target_path`, `result` labels
- Map results from existing handler error codes; derive host/path from `new URL(req.url)` parse result
- Extend tests to cover target_path defaulting, labels propagation, and invalid_url cases

## Testing

- `cd libraries/http-services && rushx build`

## Risk / Rollback

- Risk: `target_path` may increase metric cardinality; monitor and apply normalization/filters if needed
- Rollback: remove the `http_proxy_target_host_requests_total` registration and sampling logic

## Links

- RFC: `.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md`
- Walkthrough: `.legion/tasks/http-proxy-app-implementation/docs/report-walkthrough-metrics.md`
