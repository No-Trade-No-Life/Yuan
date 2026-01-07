# 全仓 Rush + PNPM + TS/Heft 工具链升级（2026-01） - 上下文

## 会话进展 (2026-01-05)

### ✅ 已完成

- 盘点当前工具链版本与分布（Rush/PNPM/TS/@types/node/Heft/api-extractor）
- 拉取并记录目标版本（以 2026-01-05 npm registry 为准）
- 升级 Rush 到 5.165.0，PNPM 到 10.27.0，并完成 `rush update --full`/`rush install`
- 统一全仓 `typescript` 到 5.9.3、`@types/node` 到 24、`@rushstack/heft*`/`@microsoft/api-extractor` 到最新目标版本
- 修复构建阻塞：@yuants/tool-kit 的 @microsoft/rush-lib 跟随 Rush 升级；补齐缺失的 Heft config；处理 UI Vite/TS 兼容问题；更新 rush-prettier autoinstaller 锁文件
- 验证：`rush build` 通过（不跑 full rebuild）

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 现状盘点（关键结论）

### Rush/PNPM（来自 `rush.json`）

- `rushVersion`: `5.147.0`
- `pnpmVersion`: `6.7.1`
- `nodeSupportedVersionRange`: `>=18.15.0 <19.0.0 || >=22.11.0 <23.0.0`
- `common/config/rush/pnpm-config.json`: `useWorkspaces=true`，`strictPeerDependencies` 当前未开启

### 依赖版本分布（来自 `rg` 全仓扫描）

- `@types/node`
  - 大多数包：`"22"`
  - 例外：
    - `distributions/origin/package.json`：`"^16.11.7"`
    - `apps/vendor-turboflow/package.json`：`"18"`
- `typescript`
  - 大多数包：`"~4.7.4"`
  - 例外：
    - `ui/web`、`ui/webpilot`：`"^4.6.4"`（Vite 链路）
    - `libraries/redis-channel`：`"~5.5.4"`（已部分升级）
- `@rushstack/heft*`
  - 大多数包：`heft~0.47.5`、`heft-jest-plugin~0.16.8`、`heft-node-rig~1.10.7`
  - 例外：
    - `libraries/redis-channel`：`heft~0.68.11`、`heft-jest-plugin~0.14.1`、`heft-node-rig~2.6.46`
- `@microsoft/api-extractor`
  - 大多数包：`~7.30.0`
  - 例外：
    - `libraries/redis-channel`：`~7.48.1`

---

## 目标版本（2026-01-05 采样）

> 说明：这里记录的是 2026-01-05 查到的 npm registry 版本号；真正落地时会再确认一次并以实际执行为准。

- Rush：`@microsoft/rush@5.165.0`
- PNPM：`pnpm@10.27.0`
- TypeScript：`typescript@5.9.3`
- Node 类型：`@types/node@24.x`（写法：`"24"`）
- Heft 工具链：
  - `@rushstack/heft@1.1.7`
  - `@rushstack/heft-jest-plugin@1.1.7`
  - `@rushstack/heft-node-rig@2.11.12`
- API Extractor：`@microsoft/api-extractor@7.55.2`

---

## 关键文件

- `rush.json`：Rush/PNPM/Node 支持范围的唯一来源
- `common/config/rush/pnpm-config.json`：pnpm 行为（workspaces、overrides、peer rules）
- `common/config/rush/pnpm-lock.yaml`：升级后会产生大 diff 的核心文件
- `common/config/rush/.pnpmfile.cjs`：当前无 hook 行为（升级期间一般不动）
- 示例包：
  - `libraries/utils/package.json`：典型 Heft + API Extractor + TS 包
  - `ui/web/package.json`：Vite UI 包（非 Heft）
  - `distributions/origin/package.json`：`@types/node` 版本偏离较大
  - `libraries/redis-channel/package.json`：部分已升级的“异类”包（验证升级兼容的参考）

---

## 关键决策

| 决策                                       | 原因                                                             | 替代方案                                     | 日期       |
| ------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------- | ---------- |
| Rush 升级到 `5.165.0`                      | 获取最新 pnpm/workspaces 兼容与修复                              | 先升到较近 minor 再逐步升                    | 2026-01-05 |
| PNPM 升级到 `10.27.0`（随 Rush）           | 满足“Rush 可用的最新版本”目标，并消除 pnpm 6 锁文件/生态陈旧问题 | 先升 pnpm 9 再升 10（降低 churn）            | 2026-01-05 |
| `@types/node` 统一到 `24.x`（写法 `"24"`） | 满足需求“升级到 24”，并沿用仓库当前 `"22"` 的主版本范围写法      | 精确 pin 到 `24.10.4`（更稳定但更“死”）      | 2026-01-05 |
| TypeScript 统一到 `5.9.3`                  | 满足“升级到最新”，并为 `@types/node@24` 提供更强兼容             | UI 包单独 pin 较低 TS（需额外策略）          | 2026-01-05 |
| Heft/rig/plugin 升级到 npm 最新            | 统一构建工具链，减少老版本与新 TS 的组合问题                     | 仅升级 TS/@types/node，暂缓 Heft（风险更大） | 2026-01-05 |
| API Extractor 升级到 `7.55.2`              | 与 TS/Heft 升级协同，减少抽取阶段的兼容问题                      | 先不升 API Extractor（后续再补）             | 2026-01-05 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需进一步收敛 peer dependency 警告：处理 `distributions/origin` 的 React peer 以及 `ui/web` 的依赖树（当前不影响 build）
2. 如果要做 PR：建议把“大 lockfile 改动/工具链改动”单独拆 commit 便于 review

**注意事项：**

- `rush build` 之前发现残留的 `rush rebuild` 进程导致锁冲突，已终止进程并移除 `common/temp/rush#*.lock` 后恢复正常。

---

_最后更新: 2026-01-05 17:28 by Claude_
