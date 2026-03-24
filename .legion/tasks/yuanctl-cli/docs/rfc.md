# RFC: yuanctl 全新 CLI 平台（第一阶段最小骨架）

## Abstract

本文定义 `yuanctl` 作为**全新 CLI 平台**的第一阶段协议、命令模型与工程边界。

本 RFC MUST 作为后续工程实现的唯一设计真源。`yuanctl` MUST 只采用 `namespace/subcommand` 命令架构；当前 `tools/yuanctl` 仅作为可复用代码与现状问题来源，不参与对外协议定义。

## Motivation

当前仓库已具备多种适合 CLI 暴露的底层能力，但现有 `tools/yuanctl` 仍以 deployment 专用、硬编码资源/动词为主：

- `tools/yuanctl/src/cli/index.ts` 当前仅注册固定 deployment 类命令。
- `tools/yuanctl/src/cli/resource.ts` 当前以硬编码资源识别为中心，难以承载 namespace 扩展。
- `apps/host/src/host-manager.ts`、`apps/node-unit/src/index.ts` 已提供可被 CLI 消费的控制面能力，但 CLI 尚无统一骨架。

问题不是底层能力不足，而是缺少统一的平台层：命令树、运行上下文、输出协议、错误语义与安全门禁尚未收敛。

## Goals & Non-Goals

### Goals

- G1. `yuanctl` MUST 成为统一 CLI 入口。
- G2. 平台 MUST 只采用 `namespace/subcommand` 命令模型。
- G3. 第一阶段 MUST 收敛为静态 TypeScript 注册，不引入运行时发现。
- G4. 平台 MUST 提供统一运行上下文、输出协议、错误语义与安全门禁。
- G5. 第一阶段 MUST 以“大胆改革后的最小可实现骨架”为目标，而不是全量覆盖所有域。
- G6. 阶段计划 MUST 支持独立验收与代码替换式重构。

### Non-Goals

- NG1. 第一阶段不实现 manifest 扫描、文件系统 discovery、external plugin。
- NG2. 第一阶段不承诺 `service call`。
- NG3. 第一阶段不承诺 `yaml`、`ndjson`、`plain` 等额外输出格式。
- NG4. 第一阶段不覆盖交易、转账、AI、跟单、资金划拨等高风险域。
- NG5. 第一阶段不引入除 `namespace/subcommand` 之外的第二套命令模型。

## Definitions

- **Root Command**：`yuanctl` 顶级入口。
- **Namespace**：顶级业务分组，例如 `deploy`、`config`、`terminal`。
- **Subcommand**：namespace 下的具体动作，例如 `yuanctl deploy list`。
- **Static Registration**：通过编译期 TypeScript imports 汇总命令注册；不包含文件扫描、manifest 发现或外部加载。
- **Capability Class**：命令的固定风险类别：`read-safe`、`read-sensitive`、`write`、`destructive`、`remote-proxy`。
- **Phase**：本 RFC 定义的 rollout 阶段，而非代码分支。

## Protocol Overview

端到端流程如下：

1. 用户执行 `yuanctl <namespace> <subcommand> ...`。
2. Root 解析器 MUST 仅加载静态 TypeScript 注册表。
3. 解析器 MUST 构建统一命令树，并拒绝注册冲突。
4. 平台 MUST 按 `flag > env > config > default` 构建运行上下文。
5. 平台 MUST 依据 capability class 执行安全门禁。
6. handler MUST 返回标准结果或标准错误。
7. 输出层 MUST 默认支持 `table` 与 `json`。
8. 失败时平台 MUST 输出稳定错误码，并返回稳定 exit code。

第一阶段命令树承诺：

```text
yuanctl
  deploy
    list
    inspect
    enable
    disable
    restart
    delete
    logs
  config
    init
    current
    get-contexts
    use-context
    set-host
    set-context
```

未来阶段方向（非第一阶段承诺）：

- Phase 2 候选：`terminal list|inspect`、`host list|current`
- Phase 3 候选：`node resource-usage`、受限扩展
- `service` namespace 当前仅保留边界定义；属 Future-only，不构成 Phase 1 行为承诺

## Current State Analysis

### A. `tools/yuanctl` 当前仍是 deployment 专用 CLI

- 固定命令注册与硬编码资源识别导致核心入口持续膨胀。
- 现有 verbs/resource 风格可以作为重构输入，但不是新平台的产品约束。

### B. 仓库已有可复用控制面

- `apps/host/src/host-manager.ts` 已提供 terminal/host/service 相关控制面基础。
- `apps/node-unit/src/index.ts` 已提供 deploy/node 相关运行态与日志/资源能力。

### C. 当前阻塞点

1. 注册协议若过早抽象到 discovery/plugin，将放大一期复杂度。
2. `service call`、日志与代理类能力的安全边界尚未闭环。
3. `host` / `node` / `deploy` / `service` 的资源归属必须先收敛再实现。

## Resource & Command Boundary Table

| Namespace  | 管理什么                                            | 不管理什么                                           | 主标识/输入                       | 第一责任命令                                                           | 阶段承诺    |
| ---------- | --------------------------------------------------- | ---------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ----------- |
| `deploy`   | deployment 资源的列表、详情、启停、重启、删除、日志 | 不管理 host profile；不直接暴露 node unit 内部调试口 | deployment id / name / selector   | `list` `inspect` `enable` `disable` `restart` `delete` `logs`          | Phase 1     |
| `config`   | 本地 CLI 配置、context、host profile 选择           | 不查询远端运行态；不直接修改 deployment              | context name / host profile name  | `init` `current` `get-contexts` `use-context` `set-host` `set-context` | Phase 1     |
| `terminal` | terminal 的枚举与静态元信息查看                     | 不做服务调用；不做 host 配置修改                     | terminal id / terminal name       | `list` `inspect`                                                       | Phase 2     |
| `host`     | 本地已配置 host profile 列表与当前选择结果          | 不承诺远端 host runtime inspect；不做代理转发        | host profile name                 | `list` `current`                                                       | Phase 2     |
| `node`     | node 运行资源指标                                   | 不承诺 node logs；不替代 deploy logs                 | node id / deployment relationship | `resource-usage`                                                       | Phase 3     |
| `service`  | 未来受限服务发现/查看                               | 第一阶段不承诺 `call`；不提供通用 RPC 调试口         | terminal + service name           | 未来仅候选 `list` `inspect`                                            | Future-only |

边界解释：

- `deploy logs` MUST 作为日志主入口；`node logs` 不进入当前阶段承诺。
- `host` 在当前 RFC 中仅代表“本地配置中的 host profile 视图”，不是远端 host runtime 管理面。
- `service` 仅保留未来边界，当前 RFC 不承诺实现面。

## State Machine

### 1. 平台装配状态机

```text
BOOTSTRAP
  -> LOAD_STATIC_REGISTRY
  -> BUILD_COMMAND_TREE
  -> READY
  -> EXECUTING
  -> {SUCCEEDED | FAILED}
```

触发条件：

- 仅当静态 imports 全部成功装配时，状态才可进入 `READY`。
- 任一命令路径冲突 MUST 在 `BUILD_COMMAND_TREE` 失败。
- Phase 0/1 MUST NOT 存在 `SCAN_FILESYSTEM`、`LOAD_MANIFEST`、`LOAD_EXTERNAL_PLUGIN` 状态。

### 2. 单次命令执行状态机

```text
PARSE_INPUT
  -> RESOLVE_COMMAND
  -> RESOLVE_RUNTIME_CONTEXT
  -> CHECK_CAPABILITY_GATE
  -> INVOKE_HANDLER
  -> RENDER_OUTPUT
  -> EXIT_SUCCESS

任一阶段失败 -> MAP_ERROR -> RENDER_ERROR -> EXIT_FAILURE
```

触发条件：

- 输入 MUST 解析为唯一的 namespace/subcommand 路径；否则进入 `MAP_ERROR`。
- `destructive` 命令 MUST 经过确认门禁。
- `read-sensitive` 与 `remote-proxy` 命令 MUST 经过更严格输出/交互约束。

## Data Model

### 1. 静态注册协议

```ts
export type YuanctlCapabilityClass =
  | 'read-safe'
  | 'read-sensitive'
  | 'write'
  | 'destructive'
  | 'remote-proxy';

export interface YuanctlCommandRegistration {
  path: string[];
  summary: string;
  capabilityClass: YuanctlCapabilityClass;
  sourcePackage: string;
  supportsFormats?: Array<'table' | 'json'>;
  handler: YuanctlCommandHandler;
}

export interface YuanctlStaticRegistryModule {
  commands: YuanctlCommandRegistration[];
}
```

字段约束：

- `path` MUST 为静态常量，且第一段 MUST 为 namespace。
- `sourcePackage` MUST 用于冲突定位与 help 来源标记。
- `supportsFormats` 未声明时 MUST 默认为 `['table', 'json']`。
- Phase 0/1 注册源 MUST 来自编译期 imports 汇总。
- Phase 0/1 平台 MUST NOT 扫描文件系统、加载 manifest、读取外部插件目录。

结构演进规则：

- 新字段 MUST 采用 optional 扩展。
- 结构调整 MUST 通过同仓代码替换与同步重构完成。
- 第一阶段不为 future plugin 预留行为字段。

### 2. 运行上下文

```ts
export interface YuanctlRuntimeContext {
  argv: string[];
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  signal: AbortSignal;
  config: YuanctlConfig;
  currentContextName: string;
  selectedHostProfile?: { name: string; host_url: string };
  printer: YuanctlPrinter;
  confirm: (request: YuanctlConfirmRequest) => Promise<boolean>;
}
```

约束：

- runtime context MUST 不暴露未脱敏凭证到普通结果对象。
- handler MUST 只依赖 runtime context 与显式参数，不得自行重新解析全局配置优先级。

### 3. 标准结果对象

```ts
export interface YuanctlCommandResult<T = unknown> {
  ok: true;
  kind: string;
  data: T;
  meta?: {
    warnings?: string[];
    next?: string[];
  };
}
```

### 4. 标准错误对象

```ts
export interface YuanctlCommandError {
  ok: false;
  error: {
    code: string;
    category: 'usage' | 'config' | 'network' | 'not_found' | 'unsafe' | 'internal';
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}
```

## Error Semantics

| 错误码                    | 类别      | 可恢复性   | 重试语义                      |
| ------------------------- | --------- | ---------- | ----------------------------- |
| `E_USAGE_INVALID_ARGS`    | usage     | 用户可恢复 | 修正参数后重试                |
| `E_CONFIG_NOT_FOUND`      | config    | 用户可恢复 | 初始化或切换配置后重试        |
| `E_CONFIG_INVALID`        | config    | 用户可恢复 | 修正配置后重试                |
| `E_REGISTRY_CONFLICT`     | internal  | 需开发修复 | MUST NOT 自动重试             |
| `E_CONTEXT_NOT_FOUND`     | config    | 用户可恢复 | 切换 context 后重试           |
| `E_HOST_UNREACHABLE`      | network   | 可恢复     | MAY 退避重试                  |
| `E_NOT_FOUND`             | not_found | 用户可恢复 | 修正目标后重试                |
| `E_CONFIRMATION_REQUIRED` | unsafe    | 用户可恢复 | 增加 `--yes` 或交互确认后重试 |
| `E_CAPABILITY_BLOCKED`    | unsafe    | 不可恢复   | 需调整策略或改用低风险命令    |
| `E_OUTPUT_RESTRICTED`     | unsafe    | 用户可恢复 | 缩小范围或改成交互模式后重试  |
| `E_INTERNAL`              | internal  | 不确定     | 默认不自动重试                |

规则：

- `--output json` 失败时 MUST 输出标准错误对象。
- `retryable=true` 仅表示语义允许重试，不表示 CLI 自动重试。
- `remote-proxy`、`read-sensitive` 被策略拒绝时 SHOULD 使用 `E_CAPABILITY_BLOCKED` 或 `E_OUTPUT_RESTRICTED`。

## Security Considerations

平台 MUST 采用 capability class gating，而非仅按 destructive 分类：

| Capability Class | 示例                                       | 默认门禁                                                          |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `read-safe`      | `deploy list`、`config current`            | 默认允许；支持 `table/json`                                       |
| `read-sensitive` | `deploy logs`                              | MUST 限制大小/时间窗；SHOULD 脱敏；非 TTY MAY 额外要求显式 flag   |
| `write`          | `config set-host`、`deploy enable/disable` | MUST 做输入校验；非 TTY SHOULD 要求显式参数完整                   |
| `destructive`    | `deploy delete`、`deploy restart`          | MUST 交互确认或 `--yes`                                           |
| `remote-proxy`   | future `service call` / host request proxy | Future-only；后续若启用 MUST allowlist + JSON-only + 更高确认等级 |

安全要求：

- 输入 MUST 做 schema 校验，禁止未校验自由文本直接进入 SQL、服务名、路径或远端方法名。
- `deploy logs` MUST 复用既有日志读取约束，不得放宽 path/deployment 校验。
- 输出 MUST 不泄露 token、私钥、原始敏感 env、host 凭证。
- 读取类命令若可能造成资源耗尽，MUST 提供默认上限。
- future `service call` 若重新提案，MUST 单列为 `remote-proxy`，且不按普通 `write` 处理；该要求属 Future-only，不属于 Phase 1 验收。

## Implementation Replacement Rules & Rollout

### Implementation Replacement Rules

- 平台对外协议 MUST 仅包含本 RFC 定义的新命令树。
- help、文档、测试与实现 MUST 只围绕新命令模型构建。
- 现有 `tools/yuanctl` 代码若需复用，MUST 通过代码重构替换到新命令树。
- 仓库中的历史实现仅作为内部重构素材，不属于协议定义。

### Rollout

- **Phase 0**：RFC 收敛、资源/命令边界表、安全模型收敛。
- **Phase 1**：仅 `deploy + config + static registry + runtime/output/error/safety` 最小骨架。
- **Phase 2**：仅 `terminal list/inspect` + `host list/current`。进入该阶段前 MUST 先新增 amendment 或 implementation plan，确认最小字段集与验收样例；本 RFC 当前不把这些字段作为 Phase 1 交付承诺。
- **Phase 3**：`node resource-usage` 与受限扩展；仅在安全模型闭环后评估 future `service` 能力。进入该阶段前 MUST 先新增 amendment 或 implementation plan，确认最小字段集与验收样例；本 RFC 当前不把这些字段作为 Phase 1 交付承诺。

Rollout 规则：

- 每个 phase MUST 可独立验收。
- Phase 2/3 任一失败 MUST 不阻塞 Phase 1 可用性。
- 静态注册调整 SHOULD 通过增删 import/registration 实现，而不是引入半启用动态扫描逻辑。

## Testability

以下 requirement MUST 可映射到测试断言：

- R1. `yuanctl` MUST 以 namespace/subcommand 作为唯一命令模型。
- R2. Phase 0/1 MUST 仅使用静态 TypeScript 注册。
- R3. Phase 0/1 MUST NOT 扫描文件系统、加载 manifest、加载 external plugin。
- R4. 注册冲突 MUST 在装配期失败，并报告 `sourcePackage`。
- R5. 输入 MUST 解析为唯一的 namespace/subcommand 路径；未知路径 MUST 产生稳定 usage 错误。
- R6. runtime context MUST 按 `flag > env > config > default` 解析。
- R7. 输出层 MUST 至少支持 `table` 与 `json`。
- R8. `--output json` 失败时 MUST 输出标准错误对象。
- R9. capability class MUST 至少包含 `read-safe`、`read-sensitive`、`write`、`destructive`、`remote-proxy`。
- R10. `destructive` 命令在非 TTY 下 MUST 要求 `--yes` 或等价显式确认。
- R11. `deploy logs` MUST 归类为 `read-sensitive`，并施加默认大小/时间窗限制。
- R12. 第一阶段 MUST 不承诺 `service call`。
- R13. 第一阶段 MUST 仅承诺 `deploy` 与 `config` namespace。
- R14. Phase 2 MUST 仅扩展 `terminal list/inspect` 与 `host list/current`。
- R15. Phase 3 MUST 将 `node` 收敛到 `resource-usage`，不得默认承诺 `node logs`。
- R16. `deploy logs` MUST 作为日志主入口；当前阶段 MUST 不引入 `node logs` 主入口。
- R17. 平台 MUST 只暴露本 RFC 定义的新命令树。
- R18. Future-only：future `service call` 若重新提案，MUST 归类为 `remote-proxy`；不属于 Phase 1 验收。
- R19. Future-only：future `service call` 若重新提案，MUST 仅允许 allowlist 的 service+method 组合；不属于 Phase 1 验收。
- R20. Future-only：future `service call` 若重新提案，MUST 仅接受 JSON 文件或 JSON 字符串输入；不属于 Phase 1 验收。
- R21. 第一阶段默认输出承诺 MUST 仅为 `table/json`。
- R22. Phase 2/3 失败 MUST 不影响 Phase 1 的命令装配与执行。
- R23. 所有 MUST 行为 MUST 存在可定位测试断言或回归用例。

建议测试映射：

| Requirement      | 测试断言                                       |
| ---------------- | ---------------------------------------------- |
| R1-R5            | 静态 registry 装配、解析与冲突单测             |
| R6-R8            | runtime/output/error 单测与快照测试            |
| R9-R11           | capability gate 与安全策略测试                 |
| R12-R17, R21-R22 | 分阶段 scope、命令树唯一性与阶段约束测试       |
| R18-R20          | Future-only guardrail；不计入 Phase 1 测试验收 |
| R23              | requirement-to-test 索引检查                   |

## Open Questions

1. `terminal inspect` 的最小字段集应直接复用现有 terminal info，还是先做 CLI 专用裁剪视图？
2. `host current` 是否只展示当前 profile，还是同时展示来源（flag/env/config）？
3. Phase 3 的“受限扩展”是否先纳入 `service list/inspect`，还是先只做 `node resource-usage`？

## Plan

本章节为工程执行唯一设计真源。

### 1. 核心流程

- Step 1：在 `tools/yuanctl` 内拆出最小平台骨架：`static-registry`、`runtime-context`、`output`、`error`、`safety`。
- Step 2：将现有 deployment 能力重构接入 `deploy` namespace，并删除历史入口实现。
- Step 3：引入 `config` namespace，统一承接 context/host profile 配置逻辑。
- Step 4：仅以编译期 imports 汇总 `deploy`、`config` 注册，不实现任何 manifest/discovery/plugin。
- Step 5：以 requirement 编号补齐单测、集成测试与分阶段验收说明。

### 2. 接口定义

- `buildStaticRegistry(modules: YuanctlStaticRegistryModule[]): YuanctlCommandRegistration[]`
- `buildCommandTree(commands: YuanctlCommandRegistration[]): CliTree`
- `resolveCommand(argv: string[]): ResolvedCommand`
- `createRuntimeContext(parsedInput): Promise<YuanctlRuntimeContext>`
- `checkCapabilityGate(command, context): Promise<void>`
- `renderResult(result, format: 'table' | 'json'): void`
- `renderError(error, format: 'table' | 'json'): never`

### 3. 文件变更明细（目标实现面）

- `tools/yuanctl/src/cli/index.ts`：从硬编码入口改为静态 registry 装配入口。
- `tools/yuanctl/src/cli/resource.ts`：重构或下沉为 `deploy` namespace 内部实现，不再作为对外命令模型入口。
- `tools/yuanctl/src/cli/static-registry.ts`：新增静态注册汇总。
- `tools/yuanctl/src/cli/runtime-context.ts`
- `tools/yuanctl/src/cli/output.ts`
- `tools/yuanctl/src/cli/error.ts`
- `tools/yuanctl/src/cli/safety.ts`
- `tools/yuanctl/src/namespaces/deploy/**`
- `tools/yuanctl/src/namespaces/config/**`
- `apps/host/**`、`apps/node-unit/**`：在 Phase 1 默认不改；待 Phase 2/3 再按需评估。

### 4. 验证策略

- 单测：静态 registry、命令解析、配置优先级、capability gate、错误对象。
- 集成测试：`deploy` 与 `config` 的 table/json 输出、help、exit code。
- 约束测试：验证命令解析仅接受 RFC 定义的新命令树，且不存在第二套入口实现。
- 阶段验收：Phase 1 仅以最小骨架与两组 namespace 为完成标准。

### 5. 成功标准

- Phase 0：RFC blocking issues 全部收敛，边界与安全模型可评审。
- Phase 1：`deploy + config + static registry + runtime/output/error/safety` 通过测试并形成最小骨架。
- Phase 2：新增 `terminal`/`host` 不破坏 Phase 1。
- Phase 3：仅在安全模型验证完成后再扩展 `node`/`service`。

### 6. Future Direction（非当前承诺）

- 若后续重新评估 `service list/inspect`，MAY 先于 `service call` 落地。
- 若后续重新评估 `service call`，MUST 以独立 RFC 或 RFC amendment 明确 allowlist、JSON-only、确认文案与审计要求；该能力在当前 RFC 中属 Future-only，不纳入 Phase 1 验收。
- manifest/discovery/external plugin 仅可在 Phase 1 稳定后另行提案，当前 RFC 不预留实现承诺。
