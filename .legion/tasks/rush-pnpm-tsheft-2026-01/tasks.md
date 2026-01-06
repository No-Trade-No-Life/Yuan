# 全仓 Rush + PNPM + TS/Heft 工具链升级（2026-01） - 任务清单

## 快速恢复

**当前阶段**: 阶段 2 - 落地实施（待 Review 后执行）
**当前任务**: (none)
**进度**: 8/8 任务完成

---

## 阶段 1: 调研与方案 ✅ COMPLETE

- [x] 盘点当前 Rush/PNPM/TS/@types/node/Heft/API Extractor 版本与分布 | 验收: 在 context.md 记录现状与变更范围（包含至少 1 个代表性包示例）
- [x] 确定目标版本（Rush 最新、PNPM 为其支持的最新、TS 最新、@types/node 固定 24.x、Heft/rig/plugin 最新、api-extractor 最新） | 验收: 在 context.md 记录各工具目标版本号与选择理由（含备选方案）
- [x] 输出升级执行步骤、验证清单、风险与回滚策略 | 验收: plan.md 包含可执行的分阶段步骤与明确的验收标准

---

## 阶段 2: 落地实施（待 Review 后执行） ✅ COMPLETE

- [x] 升级 Rush 版本与配套脚本/配置（如需要） | 验收: `node common/scripts/install-run-rush.js -h` 显示新 Rush 版本；`rush install` 可运行
- [x] 升级 PNPM 到新 Rush 支持的最新版本并重算 lockfile | 验收: `rush update --full` 成功；`common/config/rush/pnpm-lock.yaml` 由新 pnpm 格式生成
- [x] 批量升级各包 devDependencies：@types/node=24、typescript=最新、heft\*、api-extractor | 验收: 全仓 `rg '"@types/node"'` 等关键依赖无旧版本残留；`rush install` 通过
- [x] 修复因 TS/Heft 升级导致的构建/测试问题 | 验收: 关键命令 `rush rebuild`（或仓库既定 build 命令）通过；必要时补充 globalOverrides/peerRules 并记录
- [x] 格式化与收尾 | 验收: prettier 无格式噪音；context.md 写好交接与后续观察点

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-01-05 17:29_
