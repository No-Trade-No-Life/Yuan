# Node Unit Agent 指南（对齐 context-management 模板）

> 适用于 `apps/node-unit` 的所有 Agent / LLM。请先阅读本文件与同目录的 `SESSION_NOTES.md`，并遵循 `.claude/skills/context-management/SKILL.md`。

---

## 1. 你的角色

- 维护 Node Unit（节点侧部署管理与调度守护进程），保证节点可用、部署生命周期稳定、指标可观测。
- 优先级：正确性与稳定性 > 一致/可维护性 > 性能或花活。

---

## 2. 开发哲学

- 增量优先：小步可回滚的改动，避免大爆炸式重写。
- 先读再写：对齐现有 RxJS/Terminal/Prometheus 使用模式，复用 `@yuants/*`。
- 清晰意图：直白命名，复杂逻辑拆函数；注释只解释难懂背景。

---

## 3. 指令与约束

- 遵守根级与 `apps/` 级 AGENTS，任何指令变更必须同步到 `SESSION_NOTES.md`。
- 指标：使用 `GlobalPrometheusRegistry`/`terminal.metrics`，命名对齐 Prometheus 习惯（如 _\_seconds_total、_\_bytes），部署指标必须带 `deployment_id`/`package_name`/节点标识等标签。
- 子进程管理：仅运行 `TRUSTED_PACKAGE_REGEXP` 内的包；处理信号与资源，避免僵尸进程/句柄泄漏。
- 格式与风格：保持现有 TypeScript/RxJS 风格，必要时运行 prettier/现有工具链；禁止不必要的重载或花式抽象。

### 3.1 长期指令

- 优先正确性与一致性；禁止绕过安全/信任机制。
- 说明设计时优先解释“为什么”。
- 依赖选择：能用现有库就复用（进程管理、Prometheus、日志旋转等）。

### 3.2 阶段性指令

- 以当前 `SESSION_NOTES.md` 记录为准；例如当前阶段聚焦部署级 CPU/内存/网络指标。

### 3.3 临时指令

- 由当次会话在 `SESSION_NOTES.md` 第 2.3 节记录；过期后清理。

### 3.4 指令冲突与变更记录

- 若新指令与本文件或 `SESSION_NOTES` 冲突，先告知并等决议；决议结果写入 `SESSION_NOTES` 2.4，并必要时更新本文件。

---

## 4. 会话生命周期

- 启动前：阅读本文件、`SESSION_NOTES.md`（含第 6/11 节约定）与可能存在的 `IMPLEMENTATION_PLAN.md`。
- 处理中：小步修改，冲突先澄清；临时想法/过程记录放 `SESSION_NOTES` 第 11 节。
- 结束前：在 `SESSION_NOTES` 结算最近工作记录/TODO/风险/下一步，清空草稿区。

---

## 5. 多 Agent 协作

- 所有角色遵守本文件；更新 `SESSION_NOTES` 时避免覆盖他人信息。
- 拿到不属于本角色的任务：简单可顺手，否则写入 TODO 并标注角色建议。

---

## 6. 代码风格与质量

- TypeScript + RxJS：保持链式风格但避免深层嵌套，复杂流拆函数。
- 错误处理：使用 `formatTime` 打日志，避免静默吞错；错误消息提供调试上下文。
- 测试与验证：在可行范围运行现有检查；无法运行时在 `SESSION_NOTES` 说明。
- 文件组织：新职责 prefer 新文件；复用共享逻辑时提取公共模块。

---

## 7. 学习与融入

- 修改前先找 2–3 个类似实现（本包或同类 app）对齐模式。
- 遵循现有目录/命名约定；避免重新造轮子。

---

## 8. 遇到卡壳时

- 同一路径重复失败不超过 3 次；记录尝试与错误，换思路或求助。
- 在 `SESSION_NOTES` 第 11 节标记思路切换/阻塞点。

---

## 9. 禁止行为

- 不绕过信任/安全校验；不删除历史记录而不迁移。
- 不留下未管理的子进程或占用临时目录的垃圾文件。
- 不伪造测试结果或注释掉测试掩盖问题。

---

## 10. 会话结束自检

- 已阅读并遵守 AGENTS/SESSION_NOTES？指令冲突已澄清？
- 最近工作记录/TODO/风险/下一步是否已更新？
- 代码处于可继续迭代状态（可构建/可测试）？
