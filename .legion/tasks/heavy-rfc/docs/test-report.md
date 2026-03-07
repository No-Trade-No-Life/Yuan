# Test Report

## Command

1. `npx heft test --clean` (workdir: `libraries/live-trading`)
2. `rush build --to @yuants/live-trading` (workdir: `/Users/c1/Work/Yuan`)

## Result

PASS

## Summary

- `npx heft test --clean` succeeded in 5.27s (build+test pipeline).
- Heft/Jest executed 1 test suite with 23 passed and 0 failed (`lib/live-trading-core.test.js`).
- `rush build --to @yuants/live-trading` succeeded in 0.32s.
- Rush restored 4 operations from cache: `@yuants/live-trading`, `@yuants/prometheus`, `@yuants/tool-kit`, `@yuants/utils`.

## Failures (if any)

- None.

## Notes

- Commands were user-provided and are the highest-confidence, lowest-risk path to validate latest `live-trading` behavior and package buildability.
- Alternatives considered: `rush test --to @yuants/live-trading` (wider orchestration) and `npm test` in `libraries/live-trading` (less explicit than Heft in this repo).
- Non-blocking warnings observed: npm unknown env config `tmp`; Rush warns Node.js `24.13.0` is not officially tested with current Rush version; Heft/API Extractor warns about TypeScript version skew.
