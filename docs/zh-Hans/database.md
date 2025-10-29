# 数据库

由于 SQL 的复杂性，各种 SQL 数据库具有很大的差异性，较为复杂的 SQL 语句通常是不兼容的，我们默认只考虑在 PostgreSQL 上能够成功运行，甚至我们会要求 PostgreSQL 安装指定的插件 (例如 TimeScale DB)。

## 核心组件

### [@yuants/postgres-storage](apps/postgres-storage)

这是一个 PostgreSQL 存储服务。它将 PostgreSQL 数据库实例接入主机服务，同时隐藏连接 PostgreSQL 所需的登录凭证。

### [@yuants/sql](libraries/sql)

客户端侧的 SQL 库，提供向主机中的 PostgreSQL 读写数据的快捷能力。

### [@yuants/tool-sql-migration](tools/sql-migration)

这是一个用于管理 SQL 数据库模式迁移的工具。它可以帮助您创建和应用数据库迁移脚本，以确保数据库模式与应用程序代码保持同步。

## 数据库要求

- **PostgreSQL**: 作为主要的关系型数据库
- **TimeScaleDB**: 时序数据库扩展，用于高效存储时间序列数据
- **连接 URI**: 通过 `POSTGRES_URI` 环境变量配置数据库连接

## 数据存储特点

- 支持时序数据的优化存储
- 提供数据迁移和版本管理
- 隐藏数据库连接细节
- 提供便捷的 SQL 操作接口

## 使用建议

- 推荐使用 Docker 部署 TimeScaleDB
- 定期备份重要数据
- 使用 SQL 迁移工具管理数据库模式变更

<p align="right">(<a href="../../README.md">返回 README</a>) | <a href="architecture-overview.md">架构概述</a></p>
