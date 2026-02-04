# Walkthrough - Benchmark Updates

## 目标与范围

- 目标: 为 HTTP Proxy Service 的 benchmark 增补 selector 微基准与阈值判定，并固化本地 Host/allowedHosts 约束下的可复现运行流程。
- 范围:
  - `libraries/http-services/benchmarks/index.ts`
  - `libraries/http-services/benchmarks/setup.ts`
  - `.legion/tasks/http-proxy-service/docs/spec-bench.md`
  - 评审材料: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code-bench.md`、`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security-bench.md`

## 设计摘要

- 设计依据:
  - RFC: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
  - Bench Spec: `.legion/tasks/http-proxy-service/docs/spec-bench.md`
- 关键设计:
  - 基准场景固定 Light/Medium/Heavy/High Concurrency 四类，并输出统一的 Requests/Duration/RPS/Latency/Thresholds/Result。
  - 新增 selector 微基准，覆盖 pool size 1/16/128/1024，采用固定 iterations 与 warmup，阈值不达标即整体 FAIL。
  - Host 使用策略: 非本地 HOST_URL 默认忽略，需 `ALLOW_REMOTE_HOST=true` 显式启用远端；否则自动启动本地 Host。
  - Proxy 侧限制 `allowedHosts=['localhost']`，避免外部访问干扰与安全风险。

## 改动清单

- Benchmark 入口与阈值判定:
  - `libraries/http-services/benchmarks/index.ts`: 固定参数、输出 ResultJSON、selector 微基准、远端 Host 保护。
- Benchmark 环境与安全边界:
  - `libraries/http-services/benchmarks/setup.ts`: 本地测试服务器、Host 启停、allowedHosts 限制。
- 文档补充:
  - `.legion/tasks/http-proxy-service/docs/spec-bench.md`: 增补 selector 微基准场景与阈值、运行环境约束。

## 如何验证

- 本地运行:
  - `cd libraries/http-services && npm run bench`
  - 预期: 控制台输出每场景 ResultJSON，最终 `Benchmark complete. PASS` 且进程退出码为 0。
- 允许远端 Host:
  - `ALLOW_REMOTE_HOST=true HOST_URL=ws://<remote-host> npm run bench`
  - 预期: 若远端可用，仍输出 PASS/FAIL 与 ResultJSON；不满足阈值时进程退出码为 1。
- 可选剖析:
  - `npm run bench:profile`
  - `npm run bench:flame`

## Benchmark 结果 / 阈值说明

- 阈值定义: 见 `.legion/tasks/http-proxy-service/docs/spec-bench.md` 中 Light/Medium/Heavy/High Concurrency 与 Selector 微基准阈值。
- 本次执行记录: bench 已在本地 Host 环境运行通过（PASS），未落盘具体数值；以控制台 ResultJSON 为准。
- 约束说明: 非本地 HOST_URL 默认忽略，需要 `ALLOW_REMOTE_HOST=true` 才允许远端；proxy 侧仅允许 `localhost` 目标。

## 可观测性

- 控制台输出字段:
  - 常规场景: Requests/Duration/RPS/Latency/Thresholds/Result + ResultJSON。
  - Selector 微基准: Pool Size/Requests/Duration/RPS/Latency/Thresholds/Result + ResultJSON。
- 可选诊断: 通过 `bench:profile`/`bench:flame` 生成 CPU/内存剖析信息。

## 风险与回滚

- 风险:
  - 高并发或高迭代可能占用本地资源，影响共享环境稳定性。
  - 远端 Host 未显式允许时会被忽略，易误判为无法连接。
  - allowedHosts 仅允许 localhost，远端目标会导致请求被拒。
- 回滚:
  - 回退 `benchmarks/index.ts` 与 `benchmarks/setup.ts` 的 selector 微基准与 host 约束改动。
  - 或暂时移除 selector 阈值判定，避免 CI 因性能波动失败。

## 未决项与下一步

- 补齐文档细节:
  - 在 spec-bench 中明确 ResultJSON 字段、selector warmup 轮数与 `ip_source=http-services` 约束。
- 安全与稳定性改进:
  - 输出远端 Host 脱敏信息并提示风险。
  - 评估 bench 场景的端口白名单（如仅允许 `:3000`）。
- 结果留档:
  - 建议落盘一次完整 bench 输出到任务 docs，便于后续回归对比。
