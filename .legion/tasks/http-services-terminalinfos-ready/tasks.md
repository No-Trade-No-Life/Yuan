# http-services-terminalinfos-ready - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 梳理 terminal 初始化与 terminalInfos$ 更新路径（GetTerminalInfos + HostEvent），明确就绪条件与可能的空池情形。 | 验收: context.md 记录：事件链路、首次可用时机与空池边界条件。

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 定义异步选择 API（输入/输出/超时/错误语义）与调用点改造方案（方案 A）。 | 验收: RFC 明确 API 形态、等待策略、错误码/日志与调用点调整清单。
- [x] RFC 生成完成。 | 验收: `.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md` 覆盖最新需求并可评审。
- [x] RFC 对抗审查完成（聚焦固定 30 秒、错误语义、日志、迁移闭环）。 | 验收: `.legion/tasks/http-services-terminalinfos-ready/docs/review-rfc.md` 更新。

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 http-services 增加 async helper，并更新各 vendor 调用点使用新 API。 | 验收: 启动阶段不再因 terminalInfos$ 未就绪而抛 E_PROXY_TARGET_NOT_FOUND；功能行为保持一致。

---

## 阶段 4: 验证 ✅ COMPLETE

- [x] 最小验证：相关包 typecheck/build 或指定 vendor 构建。 | 验收: 构建通过或给出可复现失败原因。
- [x] Walkthrough 报告生成完成。 | 验收: `.legion/tasks/http-services-terminalinfos-ready/docs/walkthrough.md` 与 `.legion/tasks/http-services-terminalinfos-ready/docs/pr-body.md` 生成。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-02-05 21:07_
