# @yuants/app-postgres-storage

`@yuants/app-postgres-storage` 是 Yuan 体系中的 PostgreSQL 存储服务，通过在 Host 侧注册统一的 `SQL` 接口，为各终端提供安全、可观测的远程数据库访问能力。服务内置连接池、查询取消与指标采集，可部署在本地服务器、Docker 或 Kubernetes 集群中。

- **统一 SQL 出口**：应用启动即注册 `SQL` 服务，各终端通过 `requestSQL` 即可执行查询。
- **稳健连接池**：封装 `postgres` 驱动，默认开启空闲回收、连接寿命与上限控制。
- **查询可中断**：当调用方取消请求时，服务会终止数据库执行，避免悬挂。
- **指标可观测**：内置请求计数与耗时直方图，按调用终端区分标签，便于定位慢查询。

## 功能概览

- 自启动注册 `SQL` 服务，终端仅需调用 `requestSQL` 即可执行任意查询。
- 基于 `postgres` 驱动封装连接池，支持空闲连接回收、连接生命周期控制以及查询取消。
- 默认输出请求次数与耗时直方图指标，按调用终端进行区分，便于排查慢查询。
- 可与 `@yuants/sql`、`@yuants/tool-sql-migration` 协同使用，实现 SQL 执行、批量写入与迁移一体化。

## 快速开始

1. 安装依赖并构建：
   ```bash
   pnpm install
   pnpm --filter @yuants/app-postgres-storage run build
   ```
2. 配置数据库连接与 Host URL（示例）：
   ```bash
   export HOST_URL="wss://host.example.com?host_token=demo"
   export TERMINAL_ID="postgres-storage"
   export POSTGRES_URI="postgres://user:pass@postgres:5432/yuan"
   ```
3. 启动服务：
   ```bash
   pnpm --filter @yuants/app-postgres-storage exec node lib/cli.js
   ```

建议通过 `@yuants/node-unit` 进行托管部署，可结合环境模板统一接入监控与日志；开发阶段可使用 `ts-node src/index.ts` 直接启动服务，便于本地调试。

## 环境变量

| 变量名         | 默认值 | 说明                                                                                         |
| -------------- | ------ | -------------------------------------------------------------------------------------------- |
| `POSTGRES_URI` | 未设置 | PostgreSQL 连接串，示例：`postgres://user:pass@host:5432/dbname`。必须提供，否则启动会失败。 |

> 提示：`HOST_URL`、`TERMINAL_ID` 等终端通用变量也需要按 `Terminal.fromNodeEnv()` 约定进行配置。

## 服务与安全

- **权限控制**：建议在 Host 层结合 `HOST_TOKEN` 或网络策略，仅允许可信终端调用 `SQL` 服务。
- **查询取消**：当调用方主动中断（Abort）请求时，服务会取消数据库查询，避免长时间占用资源。
- **连接池策略**：默认空闲连接 20 秒回收、连接最长存活 30 分钟、最大连接数 20，可通过修改源代码或外层配置进行调整。

## 监控

服务使用 `PromRegistry` 暴露以下指标：

- `postgres_storage_request_total`：按 `status`、`source_terminal_id` 统计成功/失败次数。
- `postgres_storage_request_duration_milliseconds`：记录查询耗时直方图，可用于定位慢查询。

可将上述指标接入 Prometheus 或其他监控系统，结合告警及时发现数据库瓶颈。

## 开发与调试

- 开发环境建议直接执行 `ts-node src/index.ts`，便于实时调试。
- 配合 `@yuants/sql`、`@yuants/tool-sql-migration` 使用，可统一处理 SQL 执行与迁移。

如需进一步扩展，可参考 `apps/postgres-storage/src/index.ts`，了解服务注册、指标输出与连接池策略的详细实现。
