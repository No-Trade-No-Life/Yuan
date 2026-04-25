# 测试报告

## 执行命令

`node --check apps/signal-trader/dev/dummy-live-backend.js`

`bash -n apps/signal-trader/dev/run-local-live-dummy-stack.sh`

`HOST_TOKEN=dummy docker compose -f apps/signal-trader/dev/docker-compose.live-dummy.yml config`

`npm run build`

## 结果

PASS

## 摘要

- `node --check apps/signal-trader/dev/dummy-live-backend.js` 通过，dummy backend 当前语法有效。
- `bash -n apps/signal-trader/dev/run-local-live-dummy-stack.sh` 通过，dummy live 启动脚本 shell 语法有效。
- `HOST_TOKEN=dummy docker compose -f apps/signal-trader/dev/docker-compose.live-dummy.yml config` 通过，compose 可成功展开 `postgres`、`host`、`postgres-storage`、`dummy-live-backend`、`signal-trader` 五个服务。
- `apps/signal-trader/src/bootstrap-from-env.ts` 的默认 live 契约仍是 account-bound `SubmitOrder` / `CancelOrder` / `QueryPendingOrders` / `QueryAccountInfo` + SQL `"order"` 历史，并要求目标 terminal 同时暴露 `VEX/ListCredentials` marker 才能形成 route proof。
- `apps/signal-trader/dev/dummy-live-backend.js` 正好补齐这套契约：它对固定 `account_id` 暴露 `VEX/ListCredentials` 与四个 account-bound 服务，`SubmitOrder` / `CancelOrder` 会把请求写入 `${DUMMY_LIVE_OUTPUT_DIR:-/tmp/yuants-signal-trader-dummy-live}/requests.ndjson`，同时把订单状态写入 SQL `"order"` 表并维护 `state.json`。
- `npm run build`（`apps/signal-trader`）通过；Heft 跑出 2 个 suite / 35 条测试全部通过，其中 `bootstrap-from-env.test` 继续覆盖默认 VEX account-bound route proof 与服务发现语义。

## 失败项（如有）

- 无失败；仅有非阻塞提示：npm `Unknown env config "tmp"`、Heft 对 TypeScript 5.9 的兼容性提示，以及 Jest worker 未优雅退出 warning，但均未影响退出码。

## 备注

- 本轮优先执行这四条命令，因为它们正好覆盖用户点名的 dummy live 验证链路：Node 脚本语法、shell 启动脚本语法、compose 展开、以及包级 build+test。
- `docker compose config` 使用 `HOST_TOKEN=dummy`，是因为 compose 文件把 `HOST_TOKEN` 设为必填；这里只需满足配置展开，不需要真实 token。
- 备选项包括真正执行 `bash apps/signal-trader/dev/run-local-live-dummy-stack.sh start` 做端到端 smoke，或补跑 targeted `rush build -t @yuants/app-signal-trader`；但这两者成本更高，而当前用户要求是刷新本轮 dummy live 测试链路验证结果。
