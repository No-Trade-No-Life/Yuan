# alert-receiver 修复 resolve/repeat 加急与去重 - 任务清单

## 快速恢复

**当前阶段**: 阶段 1 - 调研与复现
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研与复现 ✅ COMPLETE

- [x] 梳理 alert-receiver 的消息生命周期：firing→repeat→resolve 的状态机、messageId/threadId 的存储与 dedupe key 生成方式，并用最小输入复现 resolve 也加急、resolve/repeat 重复发消息的问题。 | 验收: 在任务 context 记录：触发条件、当前错误行为的代码路径、以及期望行为的规则（含边界条件）。 ← CURRENT

---

## 阶段 2: 实现修复 ✅ COMPLETE

- [x] 调整 resolve 的处理：禁止进入加急路径；并确保 resolve 只会更新已有 message（不存在则按策略补发一次或记录告警）。 | 验收: resolve 不再触发加急；resolve 事件不会产生同一告警的多条消息。
- [x] 调整 repeat 的处理：不再发送新 message；改为对原 message 执行更新并触发“重复加急”（例如更新卡片/追加提示/刷新加急标记）。 | 验收: repeat 不产生新 message；重复触发时只会对同一 message 做可观察的重复加急更新。

---

## 阶段 3: 验证与回归 🟡 IN PROGRESS

- [x] 为 resolve/repeat 的去重与 update 行为补充测试（优先对消息发送器/存储层做 mock），并做一次本地最小运行验证。 | 验收: 新增测试覆盖 3 个 bug 点且通过；记录手工验证步骤到 context 快速交接。

---

## 发现的新任务

(暂无)

- [ ] 在具备 rush/pnpm/heft 的环境运行 `apps/alert-receiver` 与 `apps/feishu-notifier` 的 `npm run build`，确认测试通过并手工验证 resolved/repeat 不再产生重复消息。 | 来源: 本环境缺少 rush/pnpm/heft，无法运行 build/test

---

_最后更新: 2025-12-21 22:34_
