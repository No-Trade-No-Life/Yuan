# @yuants/sql

`@yuants/sql` 为 Yuan 体系提供统一的 SQL 执行与批量写入工具，让终端能以协议化方式访问数据库并高效落库。

- **即插即用的 SQL 通道**：`requestSQL` 通过 Host 上的 `SQL` 服务执行查询，不再依赖本地连接信息。
- **批量写入友好**：`buildInsertManyIntoTableSQL`、`createSQLWriter` 让结构化数据流顺畅落库，自动去重与缓冲。
- **迁移协同工具**：建议将 DDL 脚本集中在 SQL 文件中，使用 `@yuants/tool-sql-migration` CLI 统一执行迁移。

## 快速上手

使用 `requestSQL` 运行建表语句，再用 `createSQLWriter` 批量写入实时数据流：

```ts
import { Terminal } from '@yuants/protocol';
import { requestSQL, buildInsertManyIntoTableSQL, createSQLWriter } from '@yuants/sql';
import { Subject, interval, map } from 'rxjs';

const terminal = Terminal.fromNodeEnv(); // 需预先配置 HOST_URL、TERMINAL_ID 等环境变量

async function bootstrap() {
  await requestSQL(
    terminal,
    `CREATE TABLE IF NOT EXISTS trades (
       trade_id TEXT PRIMARY KEY,
       product_id TEXT NOT NULL,
       price NUMERIC NOT NULL,
       volume NUMERIC NOT NULL,
       traded_at TIMESTAMPTZ NOT NULL
     );`,
  );

  await requestSQL(
    terminal,
    buildInsertManyIntoTableSQL(
      [
        {
          trade_id: 'seed-1',
          product_id: 'BTC-USDT',
          price: 62000,
          volume: 0.01,
          traded_at: new Date().toISOString(),
        },
      ],
      'trades',
      { conflictKeys: ['trade_id'] },
    ),
  );
}

const trades$ = new Subject<{
  trade_id: string;
  product_id: string;
  price: number;
  volume: number;
  traded_at: string;
}>();

createSQLWriter(terminal, {
  tableName: 'trades',
  writeInterval: 1_000,
  columns: ['trade_id', 'product_id', 'price', 'volume', 'traded_at'],
  ignoreConflict: true,
  data$: trades$,
});

interval(1_000)
  .pipe(
    map((i) => ({
      trade_id: `tick-${i}`,
      product_id: 'BTC-USDT',
      price: 62000 + i,
      volume: 0.005,
      traded_at: new Date().toISOString(),
    })),
  )
  .subscribe(trades$);

bootstrap();
```

## 功能模块

### SQL 执行与转义

- `requestSQL(terminal, query)`：通过终端客户端调用 Host 的 `SQL` 服务执行任意查询，并返回结果。
- `buildInsertManyIntoTableSQL(data, tableName, options?)`：根据对象数组生成批量 `INSERT` 语句，支持冲突合并或忽略。
- `escapeSQL(value)`：将值安全地转义为 SQL 文字，防止注入风险。
- `escape`：`escapeSQL` 的别名（已标记为弃用，保持兼容）。

### 缓冲写入与批量导入

- `createSQLWriter(terminal, ctx)`：将 Observable 数据流缓冲后批量写入指定表，自动复用 `requestSQL`。
- `writeToSQL(ctx)`：RxJS 操作符形式的批量写入封装，可嵌入现有管道。
- `ISQLWritterContext`：配置写入表名、列、冲突策略与写入周期的上下文定义。

## 实践提示

- 使用前请通过环境变量配置 `HOST_URL`、`TERMINAL_ID` 等参数，并调用 `Terminal.fromNodeEnv()` 创建终端实例。
- Host 需提供 `SQL` 服务以实际执行查询；建议在部署阶段确认权限范围与超时时间。
- 批量写入时将 `writeInterval` 控制在 1~5 秒之间，可兼顾延迟与数据库压力；必要时结合 `conflictKeys` 去重。
- DDL 建议放置在独立 SQL 文件/文件夹，并通过 `@yuants/tool-sql-migration` CLI 统一执行，保持迁移流程可追溯。
