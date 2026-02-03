# Walkthrough Report - http-services 递归栈溢出修复（fix）

## 目标与范围

- 目标：修复 `USE_HTTP_PROXY=true` 时的 `fetch -> Terminal.fromNodeEnv -> fetch` 递归栈溢出，保留 http-services 代理能力与调用方接口不变。
- 范围：`libraries/http-services` 与 `libraries/protocol`；不改动各 vendor 调用点，仅影响 `Terminal` public IP 获取路径。

## 设计摘要

- RFC：`/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md`
- 评审：`/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-code-fix.md`，`/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-security-fix.md`
- 关键设计：在 http-services 覆盖前缓存 `globalThis.__yuantsNativeFetch`，为 proxy fetch 打标记；`Terminal` 构造中优先使用稳定 native fetch，且在 `USE_HTTP_PROXY=true` 或 native fetch 不可用/被标记时跳过 public IP 获取。

## 改动清单（按模块/文件类型）

- `libraries/http-services/src/client.ts`：
  - 缓存 `globalThis.__yuantsNativeFetch`（仅首次写入）；
  - 为 proxy fetch 设置 `__isHttpServicesFetch` 标记。
- `libraries/protocol/src/terminal.ts`：
  - public IP 获取使用稳定 native fetch 引用；
  - `USE_HTTP_PROXY=true` 或 native fetch 不可用/被标记时跳过 public IP 获取并安全降级。

## 如何验证

- 构建验证：
  - 命令：`rush build -t @yuants/http-services -t @yuants/protocol`
  - 预期：构建成功，无 TypeScript/构建错误。
  - 实际：PASS（Node 24.11.0，Rush 5.165.0）。
- 建议的运行时验证（未执行）：
  - 在启用 `USE_HTTP_PROXY=true` 的 vendor 环境触发一次真实请求，确认无栈溢出，`Terminal.fromNodeEnv()` 可用。

## Benchmark 结果或门槛说明

- 本次修复未包含 benchmark：修复范围为递归与 public IP 获取路径，无既有基线与统一执行方式；本轮仅做构建验证。

## 可观测性（metrics/logging）

- 未新增指标或日志字段；`public_ip` tag 在 `USE_HTTP_PROXY=true` 或 native fetch 不可用时可能为空。
- 若需更强排障，可按 review 建议补充 debug 日志或 public IP `trim()`（未纳入本次修复）。

## 风险与回滚

- 风险：
  - `USE_HTTP_PROXY=true` 时 `public_ip` 为空，可能降低定位公网出口的可观测性。
  - 依赖 `globalThis.__yuantsNativeFetch` 的缓存顺序；若运行时被其他模块覆盖，仍会跳过 public IP 获取。
- 回滚：
  - 回退 `libraries/http-services/src/client.ts` 与 `libraries/protocol/src/terminal.ts` 变更即可，调用方无感。

## 未决项与下一步

- 补充测试：对 RFC R1-R6 进行单元或最小集成验证（含 `USE_HTTP_PROXY` 跳过路径）。
- 评审建议（非阻塞）：
  - public IP 字段 `trim()`；
  - `USE_HTTP_PROXY=true` 跳过时增加 debug 级别日志；
  - 统一 proxy marker 常量的导出。
- 安全建议（非阻塞）：
  - public IP 获取增加超时/禁用开关；
  - URL 协议/目标白名单校验与审计链路策略说明（详见 review-security）。
