# What

- Add selector round-robin microbench to the HTTP Proxy Service benchmarks and enforce per-scenario thresholds with ResultJSON output.
- Keep bench execution deterministic with fixed iterations/warmup and local Host defaults.

# Why

- Validate proxy IP selector overhead across different pool sizes.
- Provide a clear PASS/FAIL gate for performance regressions.
- Reduce accidental remote host usage and improve bench reproducibility.

# How

- Extend `libraries/http-services/benchmarks/index.ts` with selector microbench, thresholds, and standardized result output.
- Use `libraries/http-services/benchmarks/setup.ts` to start local host/test server and constrain allowedHosts to localhost.
- Document scenarios and thresholds in `.legion/tasks/http-proxy-service/docs/spec-bench.md`.

# Testing

- `cd libraries/http-services && npm run bench`

# Risk / Rollback

- Risk: Bench can be resource-intensive; remote HOST_URL is ignored unless `ALLOW_REMOTE_HOST=true`; allowedHosts limits external targets.
- Rollback: Revert benchmark changes in `benchmarks/index.ts` and `benchmarks/setup.ts` or disable selector threshold gating.

# Links

- RFC: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Bench Spec: `.legion/tasks/http-proxy-service/docs/spec-bench.md`
- Walkthrough: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/walkthrough-bench.md`
- Code Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code-bench.md`
- Security Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security-bench.md`
