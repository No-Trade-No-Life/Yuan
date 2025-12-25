# Aster public/private API 按 host 选择 tokenBucket 并主动限流 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与交接
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 梳理 vendor-aster 的 baseURL host 列表与请求入口；确认 Aster 文档是否提供 weight/频率信息（或是否能从 exchangeInfo.rateLimits 推断） | 验收: context.md 记录：涉及的 host 列表、每类 host 的限流桶配置来源/默认值、weight 规则（已知/未知）

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 在 plan.md 写清 host->bucket 规则、tokenBucket 创建位置与参数、以及每个 API 方法调用 acquireSync 的示例 | 验收: plan.md 有可复制示例；足够支撑实现与 review

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 落地 tokenBucket 初始化 + public-api/private-api 的每个具体 API 方法请求前 acquireSync(weight)（不抽 wrapper）；用 scopeError 注入 metadata | 验收: 所有 API 调用点都经过 acquireSync；不同 host 走不同 bucket；无多余抽象；异常不吞

---

## 阶段 4: 验证与交接 ✅ COMPLETE

- [x] 补最小测试或脚本验证 host 路由与 weight；运行 tsc/测试并把结果写入 SESSION_NOTES 与 context 快速交接 | 验收: `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json` 通过；相关测试通过；文档包含可复现命令

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-24 23:45_
