# yuanctl-cli Phase 1 Walkthrough

## 目标与范围

- 目标：交付 `yuanctl` 第一阶段最小可用骨架，把 CLI 明确切换为**全新** `namespace/subcommand` 命令树。
- 本次实现范围绑定 `tools/yuanctl/**`，聚焦：
  - 全新 `namespace/subcommand` CLI 入口
  - static registry
  - 统一 runtime / output / error / safety
  - `deploy` 与 `config` 两个 namespace
- 本次**未**扩展 `terminal` / `host` / `node` / `service` 的后续 phase 能力，也**未**处理历史工具链与 TypeScript 环境问题。

## 设计摘要

- 设计真源：`.legion/tasks/yuanctl-cli/docs/rfc.md`
- 设计审查：`.legion/tasks/yuanctl-cli/docs/review-rfc.md`（PASS）
- 本次实现严格按 RFC 收敛到第一阶段最小骨架：只保留 `deploy + config + static registry`，不引入 legacy verb/resource 兼容入口，不提前承诺后续阶段能力。

## 改动清单

### 1. CLI 根入口与命令模型

- 已实现：
  - 将根入口切换为全新 `namespace/subcommand` 命令模型。
  - 移除旧 root verbs 注册路径，统一经静态注册表装配命令。
  - 解析与分发只保留单一路径，避免旧新双轨并存。
- 后续阶段再做：
  - 更大命令面扩展（如 `terminal`、`host`、`node`、`service`）。

### 2. Static Registry

- 已实现：
  - 引入静态 TypeScript 注册表，集中汇总 namespace/subcommand。
  - 第一阶段命令树固定为 `deploy/*` 与 `config/*`。
  - 注册冲突与命令边界由统一入口管理。
- 后续阶段再做：
  - manifest/discovery/external plugin 等动态发现能力。

### 3. Runtime / Output / Error / Safety 基础设施

- 已实现：
  - runtime context：统一命令运行上下文与配置加载路径。
  - output：第一阶段统一输出 `table/json`。
  - error：统一错误码、退出码与脱敏错误输出。
  - safety：落地 capability gate，覆盖 `read-sensitive` / `write` / `destructive` 等风险等级，并确保先 gate、后建连。
- 后续阶段再做：
  - 更丰富输出格式。
  - 更细粒度审计/监控。
  - `remote-proxy` 类后续命令面的扩展与额外防护。

### 4. `deploy` namespace

- 已实现：
  - `deploy list`
  - `deploy inspect`
  - `deploy enable`
  - `deploy disable`
  - `deploy restart`
  - `deploy delete`
  - `deploy logs`
- 已做收敛：
  - 输出最小化，避免回显敏感字段。
  - destructive 类命令走确认门禁。
- 后续阶段再做：
  - 更广 deployment 生态命令。
  - 与 node/host/service 的跨域编排能力。

### 5. `config` namespace

- 已实现：
  - `config init`
  - `config current`
  - `config get-contexts`
  - `config use-context`
  - `config set-host`
  - `config set-context`
- 已做收敛：
  - host URL / config key 校验。
  - 配置写入安全加固（原子写入、权限控制）。
- 后续阶段再做：
  - 更完整的 profile/context 管理体验。
  - 校验逻辑进一步抽取复用。

### 6. 测试与回归覆盖

- 已实现：
  - 重写 `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts`。
  - 覆盖 registry/命令解析、`deploy list`、`config init/current`、destructive confirmation gate。
- 后续阶段再做：
  - 补运行态 `--host-url` 非法输入回归。
  - 补更强的权限/脱敏/最小输出回归。
  - 在工具链恢复后补齐真正可执行的 Jest/Heft 通过证明。

## 如何验证

### 审查结果

- 设计审查：PASS  
  见 `.legion/tasks/yuanctl-cli/docs/review-rfc.md`
- 代码审查：PASS  
  见 `.legion/tasks/yuanctl-cli/docs/review-code.md`
- 安全审查：PASS  
  见 `.legion/tasks/yuanctl-cli/docs/review-security.md`、`.legion/tasks/yuanctl-cli/docs/review-security-recheck.md`

### 测试执行情况

- 测试报告：`.legion/tasks/yuanctl-cli/docs/test-report.md`
- 已尝试的验证命令：
  - `pnpm exec tsc -p tsconfig.json --noEmit`（workdir: `tools/yuanctl`）
  - `node common/scripts/install-run-rush.js test --to @yuants/tool-yuanctl`（workdir: repo root）
  - `pnpm exec heft test --clean --test-path-pattern cli-commands.test.ts`（workdir: `tools/yuanctl`）
- 预期：
  - `tsc --noEmit` 应完成基础类型检查
  - 包级 test 命令应进入 CLI 测试执行
  - targeted Heft/Jest 应执行 `cli-commands.test.ts`
- 实际：
  - 当前验证**未通过，不是因为本次设计/代码/安全审查失败，而是被历史工具链与 TypeScript 问题阻塞**。
  - `rush test --to @yuants/tool-yuanctl` 当前仓库不可用。
  - `tools/yuanctl` 既有 TS 报错与依赖解析问题导致测试在构建前置阶段失败。
  - `tools/yuanctl/package.json` 中既有 `heft test --clean --debug` 脚本也存在 `--debug` 歧义问题。

## 风险与回滚

### 风险

- 新 CLI 入口已切为全新命令树，若后续继续扩命令面，需要持续守住“单一路径分发、无兼容双轨”。
- capability gate、错误脱敏、最小输出当前已到位，但后续功能扩张时有回退风险。
- 测试绿灯尚未拿到，当前工程信心更多来自设计/代码/安全审查与局部测试覆盖，而非完整工具链通过。

### 回滚

- 若需止损，可回滚 `tools/yuanctl/**` 本轮 Phase 1 骨架改动，恢复到改动前入口与命令组织方式。
- 若仅需降低风险而不完全回退，可冻结新 namespace 扩展，只保留当前 Phase 1 骨架，待历史工具链/TS 问题修复后再继续。

## 未决项与下一步

### 未决项

- `tools/yuanctl` 历史 TypeScript 报错与 workspace 依赖解析问题尚未清理。
- `rushx test` / Heft 脚本链路仍有既有工具问题。
- 部分建议性回归测试尚未补齐。

### 下一步

- 先修复 `tools/yuanctl/package.json` 中测试脚本与 Heft 参数问题。
- 清理 `tools/yuanctl` 历史 TS/依赖解析问题，恢复可执行测试基线。
- 在测试链路恢复后，重新执行 `.legion/tasks/yuanctl-cli/docs/test-report.md` 中对应验证命令。
- Phase 2/3 能力（如 `terminal` / `host` / `node` / `service`）需另行按 RFC 分阶段推进，不纳入本次已实现范围。
