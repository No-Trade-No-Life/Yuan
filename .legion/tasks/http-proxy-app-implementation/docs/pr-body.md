## What

- Add target host/path labels to `http_proxy_requests_total` in `@yuants/http-services`

## Why

- Provide visibility into downstream target distribution and error patterns per host/path

## How

- Extend `http_proxy_requests_total` with `target_host` and `target_path` labels
- Map results from existing handler error codes; derive host/path from `new URL(req.url)` parse result
- Extend tests to cover target_path defaulting, labels propagation, and invalid_url cases
- Update Grafana dashboard with target host/path panels and filters

## Testing

- `cd libraries/http-services && rushx build`

## Risk / Rollback

- Risk: `target_path` may increase metric cardinality; monitor and apply normalization/filters if needed
- Rollback: remove `target_host`/`target_path` labels from `http_proxy_requests_total` sampling logic

## Links

- RFC: `.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md`
- Walkthrough: `.legion/tasks/http-proxy-app-implementation/docs/report-walkthrough-metrics.md`
