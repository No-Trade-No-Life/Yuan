# OKX OHLC：publishChannel('ohlc') 梳理 + 写入 ohlc_v2 双写 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与交接
**当前任务**: 补最小验证：单测/脚本对比同一批 OHLC 在两张表的字段值与数量；运行相关 package 的 tsc/测试；更新 context.md 快速交接。
**进度**: 4/5 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 全仓搜索 publishChannel 发布 'ohlc' 的位置，记录每个发布点的来源、channel key、payload 字段、以及下游消费者/写入点。 | 验收: context.md 中有完整清单（文件路径+函数名+简要 payload schema），并标注哪些与 OKX 相关、哪些是公共链路。
- [x] 定位 writeToSQL 的实现与调用路径：哪些地方把 OHLC 写入 SQL、写入哪张表、主键/唯一约束是什么。 | 验收: context.md 记录 writeToSQL 调用链与当前表结构/索引要点，并确认需要双写的插入点。

---

## 阶段 2: 设计（先写文档，等待 review） ✅ COMPLETE

- [x] 阅读 ohlc_v2 表结构（迁移 SQL/类型定义），设计从现有 OHLC payload → ohlc_v2 字段的映射、数据类型转换、以及冲突处理（upsert/ignore）。 | 验收: plan.md 写清字段映射表、冲突键、示例记录；列出待确认的不确定点；可直接据此进入实现。

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 writeToSQL 写入 OHLC 的位置增加 ohlc_v2 的双写：保持原表不变，同时写入 ohlc_v2（必要时补齐 encodePath/decodePath 等工具）。 | 验收: 所有 OHLC 写入都会同时落到旧表与 ohlc_v2；双写失败的错误处理符合现有模式；不会影响原链路。

---

## 阶段 4: 验证与交接 🟡 IN PROGRESS

- [ ] 补最小验证：单测/脚本对比同一批 OHLC 在两张表的字段值与数量；运行相关 package 的 tsc/测试；更新 context.md 快速交接。 | 验收: 验证命令可复现；关键映射覆盖；context.md 有回滚开关与排障指引。 ← CURRENT

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-01-05 15:00_
