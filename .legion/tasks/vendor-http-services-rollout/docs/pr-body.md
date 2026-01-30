## What

- Switch vendor-binance HTTP calls to `@yuants/http-services` `fetch` without changing public/private API signatures
- Add `USE_HTTP_PROXY` toggle with `fetchImpl` fallback (native fetch preferred when proxy disabled)
- Sanitize request logs and `ACTIVE_RATE_LIMIT` error payload
- Update dependencies/lockfile and record reviews

## Why

- Unify HTTP routing via HTTPProxy while keeping existing call sites stable
- Reduce sensitive data exposure in logs

## How

- Import `fetch` from `@yuants/http-services` in `apps/vendor-binance/src/api/client.ts`
- Gate global fetch override with `USE_HTTP_PROXY`; prefer native `fetch`, fallback to `fetchImpl` when unavailable
- Keep `requestPublic/requestPrivate` and rate-limit header handling intact
- Add dependency in `apps/vendor-binance/package.json` and refresh lockfile

## Testing

- `rush build -t @yuants/vendor-binance` (pass)
- `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` (fail: TypeScript not found in env)
- Review: `review-code` PASS; `review-security` PASS

## Risk / Rollback

- Risk: HTTPProxy not configured for Binance hosts; global fetch override when `USE_HTTP_PROXY=true`; sanitized logs reduce detail
- Rollback: set `USE_HTTP_PROXY` to false or remove `@yuants/http-services` import/dependency and restore previous logging payloads

## Links

- RFC: .legion/tasks/vendor-http-services-rollout/docs/rfc.md
- Specs: .legion/tasks/vendor-http-services-rollout/docs/spec-dev.md | .legion/tasks/vendor-http-services-rollout/docs/spec-test.md | .legion/tasks/vendor-http-services-rollout/docs/spec-bench.md | .legion/tasks/vendor-http-services-rollout/docs/spec-obs.md
- Walkthrough: .legion/tasks/vendor-http-services-rollout/docs/report-walkthrough.md
