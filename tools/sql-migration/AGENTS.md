name: sql-migration
description: SQL 迁移编写与执行准则，是 `tools/sql-migration/` 目录的权威规范。

---

# SQL Migration Agent 指南

> 本文档约束在 `tools/sql-migration/` 目录内新增或修改 SQL 的方式，确保幂等可回放。

---

## 1. 作用域

- 所有数据库结构变更、索引、触发器、函数都应在此目录编写并通过脚本执行。
- 禁止在代码仓库其他目录夹带零散 SQL，避免漏执行。

---

## 2. 文件组织规则

1. **存放位置**：DDL 必须写入 `sql/` 子目录下的 `.sql` 文件。
2. **命名约定**：文件名 = `{表名}.sql`，例如 `ohlc.sql`；只涵盖单一主表的所有相关语句。
3. **公共逻辑**：跨表通用语句写在 `__common.sql`，保证最先执行。
4. **顺序要求**：单个文件内按语句出现顺序执行；不同文件可无序，多次执行也应安全。

---

## 3. 幂等性要求

- 每条语句都要“可多次执行”：
  - `CREATE TABLE IF NOT EXISTS ...`
  - 新增列/索引时先检测或使用 `IF NOT EXISTS` 语法；
  - 约束更新可先 Drop 再 Create，或封装条件判断；
  - 函数/触发器使用 `CREATE OR REPLACE`；
  - TimeScaleDB 扩展需携带 `IF NOT EXISTS`。
- CI 会重复执行脚本，若语句非幂等将直接阻断流水线。

---

## 4. 表设计规范

1. **主键必须存在**，且列包含 `NOT NULL`。
2. **字符串统一 TEXT**，避免 `VARCHAR(n)`。
3. **时间戳统一 TIMESTAMPTZ**。
4. **禁止外键**，关联关系由应用层维护。
5. **建议字段**：
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
   - `enabled BOOLEAN NOT NULL DEFAULT FALSE`（配置类表）

### 4.1 `updated_at` 规则

- 字段定义：`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`。
- 必须配套触发器在 `UPDATE` 时自动刷新。
- 需要增量同步的表应为 `updated_at` 单独建索引。

---

## 5. 运行与协作

- 修改/新增 SQL 后更新相关 README 或迁移说明。
- 如需手动脚本顺序，使用仓库已有工具（如 `check-new-sql-migration-order.sh`）自检。
- 任何对扩展、函数的特殊假设（权限、库版本）写入 `SESSION_NOTES`。

---

## 6. 提交前自检

- [ ] 新文件位于 `tools/sql-migration/sql/` 并按表命名？
- [ ] 语句全部支持重复执行？
- [ ] 表包含主键、created_at、（若适用）updated_at/trigger？
- [ ] 公共逻辑是否抽到 `__common.sql`？
- [ ] 相关脚本/文档是否同步更新？

---

> `.clinerules/sql.md` 只复制本文件的要点用于给工具消费，若有分歧以此文件为准。
