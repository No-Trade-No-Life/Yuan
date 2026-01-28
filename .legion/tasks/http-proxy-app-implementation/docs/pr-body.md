## What

- Add `@yuants/app-http-proxy` application that starts a Terminal and registers HTTP Proxy service

## Why

- Provide a ready-to-run HTTP proxy app instead of requiring manual integration of `http-services`

## How

- Implement single entry `src/index.ts` with env-driven config, service registration, and graceful shutdown
- Add package config and build setup under `apps/http-proxy`

## Testing

- `cd apps/http-proxy && rushx build`

## Risk / Rollback

- Risk: external `PROXY_IP` lookup depends on network availability; high concurrency/token values can increase resource usage
- Rollback: revert `apps/http-proxy` changes or stop the service deployment

## Links

- RFC: `.legion/tasks/http-proxy-app-implementation/docs/rfc.md`
- Specs: `.legion/tasks/http-proxy-app-implementation/docs/spec-dev.md`, `.legion/tasks/http-proxy-app-implementation/docs/spec-test.md`, `.legion/tasks/http-proxy-app-implementation/docs/spec-bench.md`, `.legion/tasks/http-proxy-app-implementation/docs/spec-obs.md`
- Walkthrough: `.legion/tasks/http-proxy-app-implementation/docs/report-walkthrough.md`
