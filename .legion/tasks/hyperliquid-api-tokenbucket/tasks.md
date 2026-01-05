# Hyperliquid API tokenBucket：按官方限额主动限流 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与交接
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 阅读 binance-private-api-host-tokenbucket 与 huobi-publicprivate-api-tokenbucket 的实现/文档，总结“bucket 定义、维度 key、host/业务路由、acquire 插入点、观测与错误处理”模式，并记录到 context.md | 验收: context.md 有清晰的对照笔记：关键文件/入口函数、bucket 选择矩阵、以及可直接复用的代码结构

---

## 阶段 2: 设计（先写文档，等待 review） ✅ COMPLETE

- [x] 根据 Hyperliquid 官方文档梳理 rate limits & user limits；产出详细设计：bucket 列表与参数、endpoint→bucket 映射、维度 key（IP/API key/address）、默认策略、以及未来扩展（429 回退/动态 headers） | 验收: plan.md/context.md 写清：规则来源链接、bucket 表格、映射规则与示例；列出不确定点与待验证项；可直接据此进入实现

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 vendor-hyperliquid 的 request 入口（REST）调用 acquireSync；按映射选择 bucket 并扣减；加最小日志/metadata（可复用 scopeError） | 验收: 所有对外请求在发起前都会先 acquire；不同 endpoint/动作走正确 bucket；无法识别时走保守 bucket

---

## 阶段 4: 验证与交接 ✅ COMPLETE

- [x] 补最小单测/脚本验证映射与 key 隔离；运行 vendor-hyperliquid 的 tsc/测试；更新 context.md 快速交接 | 验收: 验证命令可复现；测试通过；context.md 有下一步与排障指引

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-26 15:29_
