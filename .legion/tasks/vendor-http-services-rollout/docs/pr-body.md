## What

- Roll out `@yuants/http-services` fetch integration to okx/gate/hyperliquid/aster/bitget/huobi (plus existing binance template) without changing external API signatures
- Add `USE_HTTP_PROXY` toggle with `fetchImpl` fallback (native fetch preferred when proxy disabled)
- Sanitize private request logs/error payloads to remove keys/signatures/query/params
- Update vendor dependencies/lockfile and record reviews

## Why

- Unify HTTP routing via HTTPProxy while keeping existing call sites stable across vendors
- Reduce sensitive data exposure in logs across private request paths

## How

- Introduce `fetchImpl` + `USE_HTTP_PROXY` in each vendor HTTP client module (okx/gate/hyperliquid/aster/bitget/huobi, plus binance)
- Gate global fetch override with `USE_HTTP_PROXY`; prefer native `fetch`, fallback to `fetchImpl` when unavailable
- Keep existing public/private API signatures and header handling intact
- Add `@yuants/http-services` dependencies and refresh lockfile

## Testing

- `rush build -t @yuants/vendor-binance` (pass)
- `rush build -t @yuants/vendor-okx` (pass)
- `rush build -t @yuants/vendor-gate` (pass)
- `rush build -t @yuants/vendor-hyperliquid` (pass)
- `rush build -t @yuants/vendor-aster` (pass)
- `rush build -t @yuants/vendor-bitget` (pass)
- `rush build -t @yuants/vendor-huobi` (pass)
- Review: `review-code` PASS; `review-security` PASS

## Risk / Rollback

- Risk: HTTPProxy not configured for exchange hosts; global fetch override when `USE_HTTP_PROXY=true`; sanitized logs reduce detail
- Rollback: set `USE_HTTP_PROXY` to false or remove `@yuants/http-services` import/dependency and restore previous logging payloads

## Links

- RFC: .legion/tasks/vendor-http-services-rollout/docs/rfc.md
- Specs: .legion/tasks/vendor-http-services-rollout/docs/spec-dev.md | .legion/tasks/vendor-http-services-rollout/docs/spec-test.md | .legion/tasks/vendor-http-services-rollout/docs/spec-bench.md | .legion/tasks/vendor-http-services-rollout/docs/spec-obs.md
- Walkthrough: .legion/tasks/vendor-http-services-rollout/docs/report-walkthrough.md
