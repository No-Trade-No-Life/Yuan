# Binance private-api 按 host 选择 tokenBucket 并按权重限流 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 阅读 apps/vendor-binance/src/api/client.ts 中 3 个 tokenBucket 的定义（bucketId/用途/参数），梳理 private-api 发请求的统一入口与 URL 生成方式，并确认方法注释里“权重”的表达形式 | 验收: context.md 记录：3 个 bucket 的 bucketId 与对应 host 范围；private-api 的请求入口位置；权重从注释到代码的映射方式

---

## 阶段 2: 设计（先让你 review） ✅ COMPLETE

- [x] 在 plan.md 写清 host->bucket 的映射规则、以及 acquireSync 的调用方式；并给出一个可复制的使用示例（你要求的例子会写在 plan.md） | 验收: plan.md 包含一个最小代码示例：给定 url/weight，如何 `tokenBucket(url.host).acquireSync(weight)`；并留一个 REVIEW block 让你确认映射是否正确（你确认后再标记完成）

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 private-api / public-api 的请求发送前插入“选择 bucket + acquireSync(weight)”逻辑；用 scopeError 记录 metadata；确保调用 tokenBucket 时不重复传 options | 验收: 不同 host 的请求会命中不同 bucket；token 不足会 throw（不捕获）；metadata 中能看到 host/weight/bucketId

---

## 阶段 4: 验证 ✅ COMPLETE

- [x] 补充/更新最小测试或脚本验证：不同 host 选择不同桶；weight 透传到 acquireSync；并运行相关 test/lint/tsc（取仓库现有最小可运行路径） | 验收: 新增测试通过；prettier 格式化无噪音；无明显类型错误（已新增 private/public 两个 rateLimit test suite）

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-24 23:05_
