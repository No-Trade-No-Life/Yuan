# vendor-tokenbucket-proxy-ip

TITLE: TokenBucket Proxy IP Key
SLUG: vendor-tokenbucket-proxy-ip

## RFC

- 设计真源: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`

## 摘要

- 核心流程: v2 在发送前按 `weight` 做“可承载组优先”候选选择并逐个 `acquireSync`；成功后以同源 ip 写入 `bucketKey` 与 `labels.ip`，并按 stage 归属错误码。
- 接口变更: 新增 `acquireProxyBucket(input)`，强制 `getBucketOptions(baseKey)` 作为 options 来源；灰度模式固定 `legacy_rr_single_try` / `rr_multi_try` / `helper_acquire_proxy_bucket`。
- 文件变更清单: 设计范围限定 `libraries/http-services`、`apps/http-proxy`、`apps/vendor-binance`，后续可推广到其他 vendor。
- 验证策略: 以 RFC `R1-R15` 为验收，重点覆盖高权重、多 IP 余量不均、IP 下线、空池、route 无匹配与 options 冲突。

## 目标

设计并评审多 http-proxy IP 下按 weight 自动负载均衡的 tokenBucket v2 方案，确保 key 与路由同源并可灰度回滚。

## 要点

- 以 tokenBucket 现有约束为前提（acquireSync 立即失败、read 无 ETA、bucketId 首次 options 生效）设计可执行调度。
- 在发送请求前完成 IP 选择与 acquire，确保 bucketKey 的 ip 与 labels.ip 同源。
- 优先在 vendor-binance 落地 v2 helper，保留 rr_multi_try/legacy 回滚模式。
- 用 stage 化错误语义与可观测指标闭环（pool/acquire/route/request）。
- 以 R1-R15 与 T-R1..T-R15 作为设计验收门槛。

## 范围

- libraries/http-services/src/proxy-ip.ts
- libraries/http-services/src/index.ts
- libraries/http-services/src/client.ts
- apps/http-proxy/src/index.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-binance/src/api/public-api.ts
- apps/vendor-binance/src/api/private-api.ts
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md

## 阶段概览

1. **调研与约束收敛** - 1 个任务
2. **RFC 设计与对抗审查循环** - 1 个任务
3. **设计门禁确认（等待用户批准）** - 1 个任务
4. **实现（用户批准后）** - 1 个任务
5. **验证与报告** - 1 个任务

---

_创建于: 2026-02-04 | 最后更新: 2026-02-07_
