# signal-trader-ui-console - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 5/5 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点 ui/web 现有页面注册、Terminal 连接、自定义服务调用、SQL 直读与 i18n 模式，确定 signal-trader 页面最小接入路径。 | 验收: plan.md/RFC 明确最小页面结构、复用模块、页面入口与权限边界。
- [x] 设计 signal-trader 控制台的信息架构：发布信号区、runtime 状态区、事件/审计区，以及优先走服务还是 SQL 的取舍。 | 验收: RFC 收敛页面 IA、接口映射、风险控制与验收标准。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 ui/web 新增 signal-trader 模块与页面，支持选择 runtime、发布 -1/0/1 信号，并展示 runtime config/health/event/audit 信息。 | 验收: 本地 UI 能连接 Host 并完成最小 happy path：读 runtime 状态、发一个 manual signal、看到事件/审计更新。
- [x] 按需补 signal-trader 只读服务或文档，避免前端读取敏感字段并明确 SQL 直读边界。 | 验收: 前端展示所需数据有明确来源；无 secret 泄露；服务/文档与 UI 行为一致。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 运行 ui/web 与 signal-trader 的最小构建/测试，补 walkthrough 与 PR body。 | 验收: 生成 test-report/review-code（必要时 review-security）/report-walkthrough/pr-body，且验证步骤可复现。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-19 21:34_
