# 部署指南

本指南将帮助您快速部署和运行 Yuan 系统。

## 前提条件

- nodejs >= 22.14.0，[下载 Node.js](https://nodejs.org/en/download/) 并安装，确保本地命令行中存在 `npx` 命令。

- TimeScaleDB (PostgreSQL + TimescaleDB 拓展)，参考 [官方网站](https://docs.tigerdata.com/self-hosted/latest/install/) 安装，获得一个 PostgreSQL 数据库连接 URI (`POSTGRES_URI`)。

我们强烈推荐从 Docker 直接启动 TimeScaleDB，这样可以保护操作系统不被污染。

```bash
$ docker pull timescale/timescaledb:latest-pg17
$ docker run -v </a/local/data/folder>:/pgdata -e PGDATA=/pgdata \
    -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg17
# 你可以获得 POSTGRES_URI=postgresql://postgres:password@localhost:5432/postgres
```

## 从 npx 运行 Yuan 的 Node 节点

### 1. 创建本地主机，并连接到你的数据库

```bash
$ POSTGRES_URI="<your-postgres-uri>" npx @yuants/node-unit
```

更多的配置选项，请参考 [@yuants/node-unit](./packages/@yuants-node-unit.md) 。

### 2. 手动执行创建数据库表的脚本

```bash
$ HOST_URL="ws://localhost:8888" npx @yuants/tool-sql-migration
```

### 3. 使用 Web GUI 连接刚刚创建的本地主机

打开浏览器，访问 http://y.ntnl.io ，您将看到 Yuan 的 Web GUI。

于右下角找到网络连接，配置主机，主机 URL 为 `ws://localhost:8888`，然后点击连接。

待连接成功后，您可以看到主机中的服务列表，并使用各种服务，随后请遵循 GUI 中的向导进行使用。

---

<p align="center">
  <a href="README.md">返回文档首页</a>
</p>
