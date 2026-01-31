# Refactor Grafana Dashboard & Metric Labels

## What

- **Dashboard**: Refactored `http-proxy` dashboard to group by `ip` and `hostname` instead of `region`/`tier`.
- **Server**: Updated `server.ts` to automatically inject `service.labels` (e.g., ip, hostname) into all Prometheus metrics.

## Why

- Operational needs have shifted from Region/Tier to per-instance (IP/Hostname) monitoring for better debugging.
- The existing `region` and `tier` labels were obsolete or missing.

## How

- **Metric Injection**: Modified `server.ts` to use `setDefaultLabels` on the Prometheus registry with values from `service.labels`.
- **Dashboard Updates**:
  - Replaced variables `$region`/`$tier` with `$ip`/`$hostname`.
  - Updated all PromQL queries to filter by these new variables.
  - Added "Requests by Method" and "Response Codes Breakdown" panels.
  - Used `topk(10)` for IP-based aggregations to manage cardinality.

## Testing

- ✅ **Build**: `rush build` passed.
- ✅ **Validation**: JSON syntax checked.
- ✅ **Review**: Logic verified against RFC specifications.

## Risk / Rollback

- **Risk**: High cardinality if thousands of unique IPs exist (mitigated by `topk(10)`).
- **Rollback**: Revert this PR to restore previous grouping logic.

## Links

- [RFC Document](.legion/tasks/refactor-grafana-dashboard-for-iphostname/docs/rfc.md)
- [Walkthrough Report](.legion/tasks/refactor-grafana-dashboard-for-iphostname/docs/walkthrough.md)
