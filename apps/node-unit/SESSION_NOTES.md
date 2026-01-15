# 项目会话笔记 / Session Notes — node-unit

> 单一真相源：记录 `apps/node-unit` 的目标、指令、决策、TODO 与风险。遵循 `.claude/skills/context-management/SKILL.md`。

---

## 0. 元信息（Meta）

- **项目名称**：node-unit
- **最近更新时间**：2025-11-25 12:53 CST（由 Codex 更新）
- **当前状态标签**：实现中（deployment 资源指标曝光）

---

## 1. 项目整体目标（High-level Goal）

- 提供轻量级的 Node.js 分布式调度器，管理节点上的部署生命周期与资源使用。
- 作为 Kubernetes 的轻量替代，在多节点/多地域场景下稳定运行并暴露必要的运维接口（日志、指标等）。
- 保持安全性：仅运行受信任包，避免占满节点资源或泄露凭证。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 遵循根级与 `apps/` 级 AGENTS，使用 `GlobalPrometheusRegistry`/`terminal.metrics` 暴露指标，命名对齐 Prometheus 惯例（_\_seconds_total、_\_bytes 等），指标需带上 deployment 相关标签。
- 仅运行 `TRUSTED_PACKAGE_REGEXP` 内的包；处理子进程/信号时避免遗留僵尸进程。
- 代码风格：TypeScript + RxJS，简洁命名，必要时拆函数；保存前使用项目格式化工具。

### 2.2 当前阶段指令

- 暴露 node-unit 管理的 deployment 维度的 CPU / Memory / Network 观测指标，便于构建面板查看各 deployment 状态。

### 2.3 临时指令（短期）

- 当前会话聚焦指标，不改动已有部署/日志行为，除非为指标需要的小范围调整。

### 2.4 指令冲突与变更记录

- 暂无。

---

## 3. 当前阶段的重点目标（Current Focus）

- 为每个 deployment 提供可查询的 CPU、内存以及网络相关指标（遵循 node-exporter 风格），通过 Prometheus 拉取用于后续面板。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/index.ts`：Node Unit 入口，解析环境变量，装配 Terminal，按照 deployment 记录拉起子进程并处理日志/信号。
- `src/spawnChild.ts`：子进程包装与清理，负责日志输出与 SIGKILL 终结。
- `src/logging.ts` & `LOG_ROTATION_DESIGN.md`：日志轮转实现与设计背景。

### 4.2 已做出的关键决策

- （空）— 需按会话推进更新。

### 4.3 已接受的折衷 / 技术债

- 暂无显式记录。

---

## 5. 关键文件与模块说明（Files & Modules）

- `src/index.ts`：部署调度核心逻辑、服务注册（日志读取、实时日志）。
- `src/spawnChild.ts`：子进程生命周期管理，stdout/stderr 管道。
- `src/logging.ts`：日志轮转流，可配置大小/数量/压缩。
- `LOG_ROTATION_DESIGN.md`：日志策略设计文档。

---

## 6. 最近几轮工作记录（Recent Sessions）

### 2026-01-14 — Codex

- **本轮摘要**：
  - 新增 node-unit 侧调度循环：识别失联 node-unit、释放部署地址并按最少部署数抢占未指派 deployment。
  - 抽象抢占指标接口，支持 `deployment_count` 与 `resource_usage` 策略切换；候选按 `updated_at/created_at/id` 升序固定。
  - node-unit 定期上报 CPU/内存占用到 `terminalInfo.tags`，并在抢占前记录资源快照日志。
- **修改的文件**：
  - `apps/node-unit/src/scheduler.ts`
  - `apps/node-unit/src/index.ts`
- **详细备注**：
  - 失联判定仅依赖 `terminalInfos$` 缺失；调度间隔默认 5s，可用 `NODE_UNIT_SCHEDULER_INTERVAL_MS` 覆盖。
  - 资源调度：`NODE_UNIT_CLAIM_POLICY=resource_usage` 使用 CPU/内存综合评分；权重可用 `NODE_UNIT_CPU_WEIGHT` / `NODE_UNIT_MEMORY_WEIGHT` 覆盖；资源上报为 node-unit 主进程 + 子进程聚合值。
  - E2E 验证：使用隔离环境变量（`env -i`，不继承 shell.nix）起 TimescaleDB + host + postgres-storage + 两个 node-unit，插入 21 个 `@yuants/app-portal@0.2.26` deployments；最终分配为 node-unit-1=10、node-unit-2=11，未出现抢占在线节点的情况；抢占时记录 CPU/内存快照。
  - 部署启动在本机 `env -i` 环境下失败（`spawn /nix/store/.../node ENOENT`），不影响调度验证。
- **运行的测试 / 检查**：
  - `pnpm -C apps/node-unit build`（heft test + api-extractor + post-build）通过；提示 TypeScript 版本高于 Heft。
  - `rush build --to @yuants/node-unit` 通过（提示 Node.js 24.11.0 未被 Rush 测试）。
  - E2E 手动流程：`docker run timescale/timescaledb:latest-pg15` + `apps/host/lib/cli.js` + `apps/postgres-storage/lib/cli.js` + `tools/sql-migration/lib/cli.js` + 两个 `apps/node-unit/lib/cli.js`。
  - 资源策略 E2E：`NODE_UNIT_CLAIM_POLICY=resource_usage bash scripts/e2e-node-unit-failover.sh`（含资源快照日志）。

### 2025-11-24 — Codex

- **本轮摘要**：
  - 新建 `apps/node-unit/AGENTS.md` 与 `SESSION_NOTES.md`，对齐 context-management 流程。
  - 为 deployment 增加 CPU（累计秒 + 占比）、内存 RSS 指标，使用 `pidusage` 采集；暂时禁用基于 `/proc` 的 socket/网络指标（需求待定）。
  - 扩展 `spawnChild` 支持 onSpawn/onExit 回调，注册/清理部署进程并在结束时归零相关指标。
  - 运行 `pnpm -C apps/node-unit build`：编译/测试/API Extractor 通过（logging.test.ts 全部通过）。
  - 新增 `apps/node-unit/monitoring.md`，提供 PrometheusRule 与 Grafana 查询示例（仅 CPU/RSS，网络指标暂缺）。
- **修改的文件**：
  - `apps/node-unit/AGENTS.md`, `apps/node-unit/SESSION_NOTES.md`
  - `apps/node-unit/src/index.ts`, `apps/node-unit/src/spawnChild.ts`
- **详细备注**：
  - 网络 socket/连接指标已临时禁用，后续如需恢复再评估；当前仅保留 CPU/RSS。
  - CPU 秒数计数器在 node-unit 生命周期内单调增加，重启后重置；CPU/RSS 由 `pidusage` 获取。
- **运行的测试 / 检查**：
  - 未运行自动化测试（未找到快速子集）；依赖静态审阅与逻辑推演。

---

## 7. 当前 TODO / 任务列表（Tasks & TODO）

### 7.1 高优先级（下一轮优先处理）

- [x] 在 node-unit 中暴露每个 deployment 的 CPU、内存与网络相关指标（Prometheus 兼容，含 deployment 标签）。
- [ ] 验证新指标输出是否被 metrics-collector/Prometheus 正常抓取，确认面板所需标签与含义。
- [ ] 验证失联释放与抢占调度在多 node-unit 环境下的行为（含并列最少场景）。

### 7.2 中优先级 / 待排期

- [ ] 根据指标结果优化资源/日志策略（待指标落地后评估）。

### 7.3 想法 / Nice-to-have

- [ ] 评估是否需要为 deployment 增加更多运行时健康指标（如重启次数、拉包失败计数等）。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- 子进程管理：异常退出或信号处理不当可能留下僵尸进程、文件句柄泄漏。
- 信任机制：放宽 `TRUSTED_PACKAGE_REGEXP` 或绕过校验会带来安全风险。
- 指标准确性：网络指标基于 socket 数量（含已建立 TCP），未统计吞吐量；CPU 计数器在 node-unit 生命周期内单调累加，进程重启后会归零。

---

## 9. 尚未解决的问题（Open Questions）

- 是否需要补充网络吞吐（字节级）指标，或当前基于 socket/连接数量的观测已满足面板需求？

---

## 10. 下一位 Agent 的建议行动（Next Steps for Next Agent）

1. 阅读本文件与 `AGENTS.md`，确认当前阶段指令与 TODO。
2. 验证部署指标在 metrics-collector/Prometheus 中的可见性与标签是否满足面板需求；根据需要补充吞吐类指标或说明。
3. 修改完代码后更新本文件的工作记录、TODO 与风险，尤其是网络指标的来源与假设说明。

---

## 11. 当前会话草稿 / Scratchpad（仅本轮使用）

### 当前会话（进行中） — 已结算，待下一轮填写

- （空）
