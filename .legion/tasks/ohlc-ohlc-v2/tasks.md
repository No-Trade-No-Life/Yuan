# 移除旧 ohlc 表引用并切换到 ohlc_v2 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与交接
**当前任务**: 运行最小验证（按模块 tsc 或既有 build 命令）并更新 context 交接。
**进度**: 5/6 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 全仓确认旧表 `ohlc` 的实际引用点（写入/读取/任务参数），整理为文件清单与用途说明。 | 验收: context.md 有完整清单（路径 + 使用方式 + 关联调用链）
- [x] 确认 `ohlc_v2` 表结构与 `series_id` 编码规则，评估 createSeriesProvider 的写入列/字段需要如何裁剪。 | 验收: context.md 记录字段映射与是否需要额外 helper/类型调整

---

## 阶段 2: 设计（待 review） ✅ COMPLETE

- [x] 给出逐文件替换策略：如何把旧表写入改为 `ohlc_v2`、如何处理双写/旧表兼容、以及 UI/Kernel 查询与 CollectSeries 参数的调整。 | 验收: plan.md 列出每个文件的改动要点与风险
- [x] 列出需人类确认的问题（是否删除 `ohlc.sql`、是否更新文档、是否保留旧表数据迁移/回滚策略）。 | 验收: plan.md 或 context.md 中有 REVIEW 条目

---

## 阶段 3: 实现 🟡 IN PROGRESS

- [x] 逐文件替换 `ohlc` -> `ohlc_v2`，并同步调整 `series_id` 编码/解码与写入列集合，移除旧表写入。 | 验收: 所有旧表引用清零；写入/读取逻辑对齐新表

---

## 阶段 4: 验证与交接 🟡 IN PROGRESS

- [ ] 运行最小验证（按模块 tsc 或既有 build 命令）并更新 context 交接。 | 验收: context.md 记录验证命令与结果；说明回滚/兼容注意点 ← CURRENT

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-01-07 17:35_
