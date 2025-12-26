# Huobi public/private API tokenBucket：按业务与接口类型主动限流 - 任务清单

## 快速恢复

**当前阶段**: 阶段 3 - 实现
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 梳理 vendor-huobi 现有 tokenBucket 定义与所有请求入口；列出业务线识别规则（交割/币本位永续/U 本位/现货）与接口类型识别规则（行情/非行情、交易/查询） | 验收: context.md 记录 bucket 列表（bucketId/参数/用途）、识别规则、以及不确定点与默认策略

---

## 阶段 2: 设计（先写文档） ✅ COMPLETE

- [x] 在 plan.md 写清 bucket 选择矩阵（业务线 × 接口类型 →bucket），并给出一个可复制的示例（在 publicRequest/privateRequest 中 acquireSync） | 验收: plan.md 有示例 + 明确的默认策略（例如无法识别时的保守选择）

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 publicRequest/privateRequest 中插入 acquireSync(1)；必要时补齐/重命名 bucket 定义；确保每次请求都会走限流 | 验收: 所有 public/private 请求在 fetch 前都会 acquireSync；业务线/接口类型正确路由；不捕获 token 不足异常

---

## 阶段 4: 验证与交接 ✅ COMPLETE

- [x] 新增最小单测并运行 vendor-huobi 的 tsc/heft test；更新 context/SESSION_NOTES 写入可复现命令与后续 TODO | 验收: 测试通过；文档包含可复现命令；context.md 有快速交接

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-26 00:47_
