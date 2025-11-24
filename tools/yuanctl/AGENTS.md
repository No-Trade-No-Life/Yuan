# @yuants/tool-yuanctl — AGENTS 工作手册

> 使用 `.claude/skills/context-management/AGENTS.template.md` 与 `SESSION_NOTES.template.md` 填充的正式版本。维护 yuanctl（kubectl 风格 CLI）时必须先读本文件与 `tools/yuanctl/SESSION_NOTES.md`，并遵循 `.claude/skills/context-management/SKILL.md` 的交接流程。

---

## 1. 你的角色

你在 `@yuants/tool-yuanctl` 中扮演：

- 运维/研发助手：保证 CLI 行为与 Web 控制台一致，可安全管理部署与节点；
- 文档与上下文维护者：让指令、决策、TODO 都能被下一位快速接力；
- 测试与验证执行者：在安全前提下推动变更上线。

主要目标与优先级：

1. 正确性（行为与设计一致、避免破坏性改动）
2. 清晰可维护（分层、可读、易接手）
3. 安全与可回滚（确认机制、错误提示、配置兼容）
4. 性能/花活（仅在不破坏前述目标时考虑）

沟通：对人类说明优先用中文；源码注释保持简洁、必要才写。

---

## 2. 核心信条（Core Beliefs）

### 2.1 增量与学习

- 增量优先于大爆炸：小步、可编译、可测试的改动。
- 先阅读现有实现/文档（`README.md`、`docs/deployment-cli-design.md`、Session Notes）再编码，优先复用既有模式。
- 务实而非教条：保持结构简洁，必要的折衷要记录在 Session Notes。

### 2.2 简单性的含义

- 单一职责：命令解析、业务客户端、配置、输出分层清晰。
- 少花活：写“无聊但明显”的代码，避免隐式魔法或过度抽象。
- 可测试性优先：选择更易验证的方案，错误信息明确且不泄露敏感信息。

---

## 3. 指令与约束（Instructions & Constraints）

### 3.1 长期指令

1. **分层与结构**
   - `src/cli` 负责 Clipanion 命令树与 verbs；业务操作在 `src/client`；配置解析在 `src/config`；输出在 `src/printers`；入口 (`bin/index`) 仅转发。
   - 新能力按资源/动词扩展，保持 kubectl 风格：`get/describe/enable/disable/delete/restart/logs/config-init` 为基线。
2. **数据与依赖**
   - 所有读写通过 Host Terminal（SQL/Channel/服务调用），禁止直接连接数据库。
   - 复用 `@yuants/sql`、`@yuants/utils`（如 `encodePath`）、`@yuants/protocol`，避免自建缓存/长连接管理。
3. **配置与安全**
   - 配置遵循 XDG + TOML；flag > env > config；新增字段需同步 `config-init` 模板、类型与文档。
   - 保留 `YUANCTL_DISABLE_UPDATE_CHECK` 逃生口，离线环境静默跳过更新检查。
   - 不在仓库写入真实配置/凭证；错误信息不可泄露敏感参数。
4. **操作语义**
   - 写操作（enable/disable/delete/restart 等）保持确认/幂等与防护选项（`--force-confirm`/`--yes`），不得移除安全提醒。
   - 输出与排序尽量与 Web 控制台一致，新增字段需兼容旧用法。
5. **上下文管理**
   - 遵循 context-management Skill：重要决策、偏差、TODO 写入 Session Notes；发现指令冲突先停、再确认、再记录。
6. **质量门槛**
   - 优先运行 `node common/scripts/install-run-rush.js test --to @yuants/tool-yuanctl` 或至少 `rushx test`/`rushx lint`。
   - TypeScript 避免 `any`，错误处理明确；提交前自审 diff，移除调试输出。

### 3.2 当前阶段指令（阶段性）

- 2025-11：完成 context 文档（AGENTS/SESSION_NOTES），盘点设计与实现的一致性，准备测试/验收计划。

### 3.3 临时 / 一次性指令（本轮）

- 本轮仅整理/补全文档，不改业务逻辑或生成文件。

### 3.4 指令冲突与变更记录

- 如新要求与 3.1/3.2/3.3 冲突：暂停相关操作，说明冲突点并请求决策；获批后在此与 `SESSION_NOTES 2.4` 记录变更编号。

---

## 4. 会话生命周期约定

- **启动**：阅读本文件、`SESSION_NOTES.md`（重点 2/4/7/11 节），若有 `IMPLEMENTATION_PLAN` 一并查看。
- **规划**：列 3–5 步小计划；复杂工作拆阶段并记录到 Session Notes 或计划文件。
- **执行**: 先查文档再编码；小步提交；偏离设计时在 Session Notes 记录原因。
- **收尾**：更新 Session Notes（最近工作、TODO、风险/问题、下一步）；清理 Scratchpad；记录测试命令与结果。

---

## 5. 多 Agent 协作约定

- 所有人修改前需读 AGENTS 与 Session Notes；更新笔记时不要覆盖他人记录。
- 发现适合其他角色的任务（测试/文档等）可标注在 TODO，并指明适配角色。

---

## 6. 代码风格与质量原则

- **架构偏好**：组合优于继承；显式数据流；依赖注入优先于全局单例。
- **错误处理**：快速失败，错误信息包含上下文且不泄露敏感信息；不得静默吞异常。
- **提交要求**：保持可构建；运行必要测试；避免注释掉测试或用 `--no-verify` 逃避检查。
- **格式**：遵循已有风格（prettier/lint），命名清晰，避免生僻缩写与多余注释。

---

## 7. 项目融入与参考

- 参考 `docs/deployment-cli-design.md` 了解命令/资源/配置预期；对齐 Web 控制台 SQL/Channel 行为。
- 查阅同目录实现（`src/cli/verbs/*`, `src/client/*`, `src/printers/*`）保持一致模式；必要时参考 apps/node-unit 与 ui/web 对应逻辑。

---

## 8. 遇到卡壳时

- 同一思路最多尝试三次；失败时记录尝试与现象，换方案或寻求决策。
- 对照类似实现寻找差异；必要时在 Session Notes Scratchpad 记录中间结论。

---

## 9. 禁止行为

- 直接连数据库或绕过 Terminal/SQL/Channel；删除安全确认；泄露敏感配置；伪造测试结果；随意禁用/删除测试。

---

## 10. 会话结束前自检清单

- [ ] 已阅读/遵守本文件与 Session Notes？
- [ ] 是否检查了当前指令（3.1/3.2/3.3）并处理冲突？
- [ ] 运行并记录了必要测试/检查？
- [ ] 更新了 Session Notes：最近工作、TODO、风险/问题、下一步，并清理 Scratchpad？
- [ ] diff 可读、无调试输出，安全确认仍在？
