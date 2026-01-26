# node-unit-deployment-metric-refactor - 任务清单

## 快速恢复

**当前阶段**: 阶段 3 - Verification
**当前任务**: Test deployment and verify metrics
**进度**: 3/5 任务完成

---

## 阶段 1: RFC & Design ✅ DONE

- [x] Draft RFC in plan.md | 验收: RFC plan detailed in plan.md and reviewed.

---

## 阶段 2: Implementation ✅ DONE

- [x] Modify apps/node-unit/src/index.ts | 验收: Old metrics removed, new metric added.

---

## 阶段 3: Verification 🟡 IN PROGRESS

- [x] Build and verification | 验收: Code compiles.
- [x] Update dashboard queries | 验收: All dashboard queries updated to use node_unit_deployment_info join pattern
- [ ] Test deployment and verify metrics | 验收: Deployment starts correctly, node_unit_deployment_info appears with value 1, old metrics are gone, and join queries work ← CURRENT

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-01-19 20:30_
