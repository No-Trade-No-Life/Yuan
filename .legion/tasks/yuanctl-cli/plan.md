# yuanctl 全量能力统一 CLI 设计与实现

- TITLE: RFC: yuanctl 全新 CLI 平台（第一阶段最小骨架）
- SLUG: yuanctl-unified-cli-platform

## 目标

设计并实现一个可扩展的 yuanctl 骨架，让 monorepo 内各 app/包以 namespace/subcommand 方式注册能力；该 CLI 按全新产品设计，只定义新的统一命令树。

## 要点

- 盘点现有 tool-yuanctl、apps/、libraries/ 中适合暴露到 CLI 的能力边界
- 设计 yuanctl 核心骨架：root command、namespace/subcommand 注册、共享上下文、输出协议、错误码
- 定义 app/package 如何以静态注册表方式接入 yuanctl，避免 tool-yuanctl 直接堆业务逻辑
- 规划 UI/Web 能力到 CLI 的映射原则：资源模型、动词集合、批处理/脚本化/机器可读输出
- RFC 必须明确新命令模型、测试策略、Scope 边界与非目标

## 范围

- 核心实现范围（第一阶段允许修改）
  - tools/yuanctl/\*\*
  - apps/host/\*\*
  - apps/node-unit/\*\*
  - libraries/protocol/\*\*
  - libraries/sql/\*\*
  - libraries/deploy/\*\*
- 对齐参考范围（用于调研/RFC，对实现默认只读）
  - ui/web/src/modules/Deploy/\*\*
  - ui/web/src/modules/Terminals/\*\*
  - ui/web/src/modules/Workbench/\*\*
  - ui/web/src/modules/Products/\*\*
  - ui/web/src/modules/DataRecord/\*\*
- 明确排除（本任务第一阶段不进入实现）
  - apps/vendor-\*/\*\*
  - apps/trade-copier/\*\*
  - apps/transfer-controller/\*\*
  - apps/account-composer/\*\*
  - apps/app-openai/\*\*

## 文档路径

- RFC：`.legion/tasks/yuanctl-cli/docs/rfc.md`（设计真源，后续实现 MUST 以此为准）
- RFC Review：`.legion/tasks/yuanctl-cli/docs/review-rfc.md`

## 摘要

### 核心流程

- 第一阶段仅承诺 `deploy + config + static registry + runtime/output/error/safety` 最小骨架；命令执行统一经过静态注册装配、runtime context 构建、capability gate、标准输出/错误渲染。
- `terminal/host/node/service` 仅保留阶段化边界；不提前承诺超出当前 phase 的行为。

### 接口变更

- 新增“静态注册优先”的骨架协议：static-registry、runtime context、output/error/safety。
- 现有 `tools/yuanctl` 代码仅作为重构输入，最终对外只保留新 namespace/subcommand 命令树。

### 文件变更清单

- 设计阶段仅落盘 RFC 与三文件。
- Phase 1 实现目标面聚焦 `tools/yuanctl/**`；`apps/host/**`、`apps/node-unit/**` 暂不作为第一阶段默认修改面。

### 验证策略

- 以 RFC 中 R1-R23 为测试索引，重点覆盖静态注册禁动态发现、唯一命令模型、capability gate 与阶段边界；其中 Future-only 条款不计入 Phase 1 验收。
- 第一阶段必须验证对外只存在 RFC 定义的新命令树，且命令解析不会落入第二套入口实现。

## 设计门禁

- [x] RFC 生成完成
- [x] RFC 对抗审查 PASS
- [ ] 用户批准设计（Design Approved）

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 5 个任务（含设计门禁）
3. **实现** - 1 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23_
