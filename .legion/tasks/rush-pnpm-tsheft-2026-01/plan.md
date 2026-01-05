# 全仓 Rush + PNPM + TS/Heft 工具链升级（2026-01）

## 目标

升级 RushJS 到最新版本；将 PNPM 升级到该 Rush 可用的最新版本；并把仓库内实际使用到的 `@types/node` / `typescript` / `@rushstack/heft*` / `@microsoft/api-extractor` 统一升级到目标新版本，确保 `rush install/update` 与关键构建链路可跑通。

## 边界与原则

- 本任务先输出**详细设计**，待人类 Review 通过后再开始改代码/跑大规模命令
- 不做无关重构：以“批量、机械、可回滚”的版本号升级为主
- 优先使用 Rush 官方工作流驱动（`install-run-rush` + `rush update/install`），不在仓库根目录直接 `pnpm install`
- 升级跨度大（PNPM 6 → 10，TS 4.x → 5.9），按阶段拆分，确保每一步可回滚
- UI 包（`ui/*`）不使用 Heft：只升级其 `typescript`（如出现 peer/兼容问题，再单独决策是否需要同步升级 Vite/插件）

## 范围（预计会改动）

- `rush.json`
- `common/config/rush/pnpm-lock.yaml`
- `common/config/rush/pnpm-config.json`（可能仅需确认无需改）
- `common/config/rush/common-versions.json`（当前为空，可能仍保持不动；若需要集中约束再改）
- `common/scripts/*`（原则上不手工改；若升级后确实需要跟随 Rush 模板更新，再纳入）
- 全仓各项目的 `package.json`（仅改涉及的 devDependencies）
- 少量 `tsconfig.json` / `api-extractor.json` / `config/*.json`（仅当新工具链要求调整）

## 现状摘要（已盘点的关键点）

- `rush.json`：`rushVersion=5.147.0`、`pnpmVersion=6.7.1`、`nodeSupportedVersionRange=>=18.15 <19 || >=22.11 <23`
- 代表性包 `libraries/utils/package.json`：`typescript~4.7.4`、`@types/node=22`、`@rushstack/heft~0.47.5`、`@microsoft/api-extractor~7.30.0`
- 全仓大多数包：`typescript~4.7.4` + `@types/node=22` + `heft~0.47.5`
- UI 包（`ui/web`、`ui/webpilot`）：`typescript ^4.6.4`（非 Heft 链路）
- 少数特殊包：`libraries/redis-channel` 已经在用较新 TS/Heft（`typescript~5.5.4`、`heft~0.68.11`）

## 目标版本（2026-01-05 采样，执行时以 npm registry 最新为准）

- Rush：`@microsoft/rush@5.165.0`（最新）
- PNPM：`pnpm@10.27.0`（最新，且需要确保 Rush 支持）
- TypeScript：`typescript@5.9.3`（最新）
- Node 类型：`@types/node@24.x`（package.json 里使用 `"24"` 这种“主版本范围”写法，跟当前 `"22"` 一致）
- Heft 工具链：
  - `@rushstack/heft@1.1.7`（最新）
  - `@rushstack/heft-jest-plugin@1.1.7`（最新）
  - `@rushstack/heft-node-rig@2.11.12`（最新）
- API Extractor：`@microsoft/api-extractor@7.55.2`（最新）

> 说明：当前 npm registry 的 `@types/node` 最新已经到 25.x，但本任务按需求固定到 24.x。

## 执行设计（分阶段）

### 阶段 1：Rush + PNPM 升级（先让安装链路跑起来）

1. 修改 `rush.json`：
   - `rushVersion: 5.147.0 -> 5.165.0`
   - `pnpmVersion: 6.7.1 -> 10.27.0`
2. 执行（使用仓库脚本）：
   - `node common/scripts/install-run-rush.js update --full`
3. 验证点：
   - `node common/scripts/install-run-rush.js --version` 输出 `5.165.0`
   - `rush install` / `rush update` 能成功（无须全仓 build）

### 阶段 2：批量升级仓库内依赖版本（不动业务代码）

1. 批量改 `**/package.json`（仅当依赖字段存在时才改，不给缺失的包强行新增）：
   - `devDependencies["@types/node"] = "24"`
   - `devDependencies["typescript"] = "~5.9.3"`
   - `devDependencies["@rushstack/heft"] = "~1.1.7"`
   - `devDependencies["@rushstack/heft-jest-plugin"] = "~1.1.7"`（仅存在的包）
   - `devDependencies["@rushstack/heft-node-rig"] = "~2.11.12"`
   - `devDependencies["@microsoft/api-extractor"] = "~7.55.2"`（仅存在的包）
2. 执行：
   - `node common/scripts/install-run-rush.js update --full`
3. 验证点：
   - `common/config/rush/pnpm-lock.yaml` 被新 PNPM 重算（文件会有大 diff，属于预期）
   - `rg '\"typescript\"\\s*:\\s*\"~4\\.' -S --glob='**/package.json'` 应为 0
   - `rg '\"@types/node\"\\s*:\\s*\"(16|18|22|\\^16)' -S --glob='**/package.json'` 应为 0

### 阶段 3：修复兼容性问题（仅当构建链路炸了才动代码/配置）

优先顺序（从“少改”到“多改”）：

1. 依赖/peer 冲突：优先用 `common/config/rush/pnpm-config.json` 的 `globalOverrides` / `globalPeerDependencyRules` 兜底，并把理由写入 `context.md`
2. Heft/rig 变化：如 `tsconfig` extends 路径或 `config/typescript.json` schema 需要调整，再逐包修
3. TypeScript 5.9 行为变化导致的类型错误：只做必要的最小修复
4. UI 包（Vite 3 + TS 5.9）若出现明显不兼容：
   - 方案 A：只对 `ui/*` 单独 pin 一个更保守的 TS（需要 `common-versions.json` 或 local pin，需你决定是否接受“非一致版本”）
   - 方案 B：同步升级 Vite/插件到支持 TS 5.9 的版本（改动更大，需你确认范围）

### 阶段 4：验证与收尾

- 最小验证：`rush install` + `rush rebuild --to @yuants/utils`（再补一个典型 app，例如 `--to @yuants/vendor-okx`）
- 完整验证（耗时更长）：`rush rebuild`
- 格式化：对被改动的 `package.json` 等文件跑 prettier（避免格式噪音）

## 风险清单与缓解

- **锁文件 churn 很大**：PNPM 6 → 10 会导致 `pnpm-lock.yaml` 结构变化，PR diff 巨大属预期；建议单独 commit/PR 以便 review
- **TS 4 → 5.9 可能带来新增类型错误**：先保证依赖/工具链安装可用，再集中修类型问题，避免把“安装失败”和“类型失败”混在一起
- **UI 包可能被 TS 版本牵连**：把 `ui/*` 当作单独风险域处理（必要时单独决策是否升级 Vite 生态）
- **@types/node=24 与运行时 Node=22 的不一致**：如果你希望“类型 = 运行时”，则需要同步更新 `nodeSupportedVersionRange`（不在本需求内，但建议你确认）

## 回滚策略

- 每个阶段单独提交（至少：Rush/PNPM、依赖批量升级、兼容修复）
- 任一阶段失败：直接回退该阶段 commit，并保留 `context.md` 的问题记录，避免重复踩坑

## 已决策（本次已执行）

- `nodeSupportedVersionRange`：本次不调整（维持 Node 运行时约束不变，仅升级类型与工具链）
- `ui/*` 策略：选择同步升级 Vite/插件以兼容 TS 5.9（而不是 UI 单独 pin 更低 TS）
- TypeScript 版本写法：保留原有风格（绝大多数包用 `~`；UI 包原本使用 `^`，因此继续用 `^`）

---

_创建于: 2026-01-05 | 最后更新: 2026-01-05_
