> ⚠️ 本文件仅镜像 `tools/sql-migration/AGENTS.md`，供校验脚本和阅读者速览。若需修改规则，请先更新 `tools/sql-migration/AGENTS.md` 并再同步到此处。

### 关于 SQL 文件组织方式

1. SQL DDL 必须写入 /tools/sql-migration/sql 目录下的 .sql 文件中。
1. SQL 文件按照表名组织，文件名格式为 {表名}.sql，例如 ohlc.sql，其中专门处理 ohlc 这个表及其相关内容。
1. 每个 SQL 文件中最多可以包含一个表的创建语句，其他的 SQL 语句可以是该表相关的索引、触发器、函数等。
1. 每个 SQL 文件中可以包含多条 SQL 语句，语句之间使用分号 ; 分隔。
1. 公共的 SQL 语句(例如创建扩展，公共函数) 可以放在 `__common.sql` 文件中，保证被优先执行。

### 关于幂等性

每条 SQL 语句必须幂等，即多次执行不会产生副作用。

- 创建表的 SQL 语句必须包含 IF NOT EXISTS 子句。
- 修改约束的 SQL 语句必须先检查约束是否存在，或者直接 drop 约束后重新创建。
- 添加列的 SQL 语句必须包含 IF NOT EXISTS 子句。
- 针对 TimeScaleDB 的扩展调用语句必须考虑 IF NOT EXISTS 参数。
- 创建函数或者触发器时，使用 CREATE OR REPLACE 语句。

### 关于表设计规范

1. 创建表时，必须指定主键，并且主键列必须包含 NOT NULL 约束。
1. 所有的字符串用 TEXT 类型，避免使用 VARCHAR(n)。
1. 所有的时间戳列必须使用 TIMESTAMPTZ 类型。
1. 不使用任何外键约束，所有的关联关系都通过应用层代码来维护。
1. 建议所有表都包含 created_at 时间戳列，分别表示记录的创建时间。

   - created_at 建议设置 DEFAULT CURRENT_TIMESTAMP，并且包含 NOT NULL 约束。

1. 对于配置语义的表，建议添加 enabled (BOOLEAN) 列，表示该配置是否启用，要求 NOT NULL，建议设置 DEFAULT FALSE，防止误操作。

### 关于 updated_at 列

1. 建议所有表都包含 updated_at 列，表示记录的最后更新入库时间。
1. updated_at 列必须定义为 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
1. 如果表中包含 updated_at 列，必须创建触发器，在每次更新记录时，自动将 updated_at 列的值更新为当前时间。
1. 对于可能需要增量同步的表(例如配置表)，建议为 updated_at 列创建单独的索引，方便增量同步式的查询。

### 推论: SQL 文件可以无序组织的原因，可以修改文件 (追加 SQL 语句) 后重新执行，确保所有的 SQL 语句都被执行到位。

1. 不存在跨表约束，每个表都是独立的。
1. 每条 SQL 语句都是幂等的，可以重复执行，意味着可以多次运行同一个 SQL 文件而不会产生错误。
1. SQL 文件按照表进行组织，SQL 文件内部的语句按顺序执行

好处:

1. 方便维护: 每个模块的 SQL 语句集中在一个文件中，便于查找和修改。
1. 易于扩展: 添加新的表或者修改现有表只需修改对应的 SQL 文件。

坏处:

1. 有坑: 需要确保每条 SQL 语句都是幂等的，避免因为重复执行导致错误。(有 CI 冒烟测试支持)
