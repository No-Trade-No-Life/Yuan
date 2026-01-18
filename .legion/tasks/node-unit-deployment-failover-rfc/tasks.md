# node-unit-deployment-failover-rfc - 任务清单

## 快速恢复

**当前阶段**: 阶段 1 - 调研
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 梳理 node-unit 与 deployment 绑定/调度机制的代码路径与数据结构。 | 验收: context.md 记录绑定流程、关键字段与调用路径。 ← CURRENT
- [x] 定位未调度 deployment 的发现机制与 host terminal join/exit 的发布/订阅位置。 | 验收: context.md 记录相关模块、事件名称、以及失联判定的当前做法。

---

## 阶段 2: 设计（RFC） ✅ COMPLETE

- [x] 输出 RFC 风格详细设计：失联检测、address 置空、抢占规则（一次仅抢占一个）、最少部署者优先、指标接口抽象与并发策略。 | 验收: plan.md 包含核心流程、接口/数据结构草图、边界条件与不确定点清单。

---

## 阶段 3: 实现 🟡 IN PROGRESS

- [x] 根据审批后的 RFC 落地代码修改与最小验证。 | 验收: 实现符合 RFC，相关任务清单与 context.md 更新完成。

---

## 发现的新任务

(暂无)

- [ ] [Refactor] 移除 tags 中的资源上报，暴露 NodeUnit/InspectResourceUsage 服务 | 来源: RFC v2 Implementation
- [ ] [Refactor] Scheduler 改为主动轮询资源用量 | 来源: RFC v2 Implementation
- [ ] [Test] 更新单元测试适配 Service 调用的 Mock | 来源: RFC v2 Implementation

---

_最后更新: 2026-01-15 15:16_
