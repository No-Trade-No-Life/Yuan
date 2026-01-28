# Walkthrough Report: HTTP Proxy App Implementation

## 目标与范围

- 目标: 提供一个轻量级应用 `@yuants/app-http-proxy`，作为 Terminal 启动并注册 HTTP Proxy 服务。
- 范围: `SUBTREE_ROOT=apps/http-proxy`，聚焦应用入口与配置化启动。

## 设计摘要

- RFC: `./rfc.md`
- Specs: `./spec-dev.md`, `./spec-test.md`, `./spec-bench.md`, `./spec-obs.md`
- 关键设计: 入口在 `src/index.ts`，通过环境变量驱动配置；自动获取 `PROXY_IP`（可覆盖）；提供并发与入队令牌桶容量选项；支持优雅退出。

## 改动清单

- 应用代码: `apps/http-proxy/src/index.ts`（Terminal 启动、环境变量校验、labels/options 映射、优雅退出）
- 配置与清单: `apps/http-proxy/package.json`, `apps/http-proxy/tsconfig.json`
- 设计与规格文档: `.legion/tasks/http-proxy-app-implementation/docs/*`

## 如何验证

- `cd apps/http-proxy && rushx build`
  - 预期: TypeScript 编译通过并生成 `lib/*` 构建产物
- (手动) `pnpm start`
  - 预期: 服务能注册；SIGINT/SIGTERM 触发优雅退出日志

## Benchmark

- 未执行专门压测
- 性能门槛: 启动时间 < 1000ms，空闲内存 < 64MB RSS（见 `./spec-bench.md`）

## 可观测性

- Logs: 关停信号与异常日志；敏感信息脱敏
- Metrics: 复用 `@yuants/protocol` Terminal 指标与 `http-services` 计数指标（如有）

## 风险与回滚

- 风险: 外部 `PROXY_IP` 获取依赖网络可用性；并发/限流参数过大导致资源压力
- 回滚: 直接回退应用目录 `apps/http-proxy` 的变更，或在部署侧停止该服务实例

## 未决项与下一步

- 如需避免外部请求，可显式设置 `PROXY_IP`
- 可选补充集成测试：验证 Host 侧服务注册与请求连通性
- 在部署/运维文档中补充启动示例与参数推荐值
