# yuanctl 全量能力统一 CLI 设计与实现 - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 7/7 任务完成

---

## 阶段 1: 调研 ✅ DONE

- [x] 审视 `tools/yuanctl` 当前结构、入口、依赖、命令模型，以及仓库内现有 app/service 的能力分布，找出 CLI 复用点与阻塞点。 | 验收: 形成 current-state 摘要：现有 yuanctl 能做什么、缺什么、哪些 app 能以 namespace/subcommand 暴露。

---

## 阶段 2: 设计 🟡 IN PROGRESS

- [x] 输出 RFC，定义 `yuanctl` 的架构骨架、注册协议、命令发现/装配方式、输出/错误/鉴权/配置约定，以及 UI/Web 能力映射策略。 | 验收: `.legion/tasks/yuanctl-cli/docs/rfc.md` 形成完整设计。
- [x] 调用 review-rfc 对 RFC 进行对抗审查并收敛。 | 验收: 审查结论为 PASS，报告位于 `.legion/tasks/yuanctl-cli/docs/review-rfc.md`。
- [x] 明确第一阶段实现 Scope：优先改哪些目录、哪些 app 先接入、哪些能力暂不纳入。 | 验收: plan.md 与 RFC 均包含可执行的阶段化落地范围。
- [x] 将 RFC 链接与设计门禁状态更新到 plan.md。 | 验收: plan.md 可直接作为设计索引，包含 RFC 路径与门禁项状态。
- [x] 请求用户确认设计（Design Approved）。 | 验收: 获得用户明确确认后，方可进入实现阶段。

---

## 阶段 3: 实现 🟡 IN PROGRESS

- [x] 在设计获批后实现 yuanctl 核心骨架与首批 namespace/subcommand 接入，并补充验证。 | 验收: yuanctl 可加载注册命令，至少覆盖首批高价值能力，并具备后续扩展路径。

---

## 发现的新任务

(暂无)

- [x] 修订 RFC：明确 Phase 0/1 仅静态 TypeScript 注册，并把 manifest/discovery/external plugin 降为非目标。 | 来源: `docs/review-rfc.md` Blocking Issues #1
- [x] 修订 RFC：删除 legacy deploy compat、旧 verbs/resource 迁移与 sunset policy，明确新 CLI 不提供对外兼容承诺。 | 来源: 用户新增最高优先级约束
- [x] 修订 RFC：收敛 `service call`、`host`、`node logs`、`deploy logs` 的命令边界与安全模型，必要时将 `service call` 移出第一阶段。 | 来源: `docs/review-rfc.md` Blocking Issues #3-#5
- [x] 修订 RFC：移除 `Backward Compatibility`、`兼容策略` 及所有 legacy/compat/sunset/旧命令映射措辞，改写为纯新 CLI 正向协议表述后再复审。 | 来源: 2026-03-23 最新 RFC 审查 FAIL

---

_最后更新: 2026-03-23 22:14_
