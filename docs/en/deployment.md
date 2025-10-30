# Deployment Guide

This guide will help you quickly deploy and run the Yuan system.

## Prerequisites

- nodejs >= 22.14.0, [Download Node.js](https://nodejs.org/en/download/) and install it, ensure the `npx` command is available in your local command line.

- TimeScaleDB (PostgreSQL + TimescaleDB extension), refer to the [official website](https://docs.tigerdata.com/self-hosted/latest/install/) for installation, and obtain a PostgreSQL database connection URI (`POSTGRES_URI`).

We strongly recommend starting TimeScaleDB directly from Docker to protect your operating system from contamination.

```bash
$ docker pull timescale/timescaledb:latest-pg17
$ docker run -v </a/local/data/folder>:/pgdata -e PGDATA=/pgdata \
    -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg17
# You can get POSTGRES_URI=postgresql://postgres:password@localhost:5432/postgres
```

## Running Yuan Node Unit from npx

### 1. Create a local host and connect to your database

```bash
$ POSTGRES_URI="<your-postgres-uri>" npx @yuants/node-unit
```

For more configuration options, please refer to [@yuants/node-unit](./packages/yuants-node-unit.md).

### 2. Manually execute the database table creation script

```bash
$ HOST_URL="ws://localhost:8888" npx @yuants/tool-sql-migration
```

### 3. Connect to the newly created local host using Web GUI

Open your browser and visit http://y.ntnl.io, you will see Yuan's Web GUI.

Find the network connection in the bottom right corner, configure the host with URL `ws://localhost:8888`, then click connect.

After successful connection, you can see the service list in the host and use various services. Then follow the wizard in the GUI for usage.

---

<p align="center">
  <a href="README.md">Back to Documentation Home</a>
</p>
