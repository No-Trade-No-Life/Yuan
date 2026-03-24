# 安全审查报告

## 结论

PASS

## 审查范围

- `apps/signal-trader/**`
- 本轮重点复核 dummy live 测试链路：dummy backend 暴露 `VEX/ListCredentials` marker + account-bound 服务，是否与当前 route proof 假设兼容；请求落文件与 SQL `"order"` 写入是否引入明显风险；文档是否足够明确说明“这是测试桩，不是真实交易行为”；当前是否存在 blocker。

## 阻塞问题

- 无

## 建议（非阻塞）

- `apps/signal-trader/src/bootstrap-from-env.ts:148`、`apps/signal-trader/src/bootstrap-from-env.ts:278`、`apps/signal-trader/src/bootstrap-from-env.ts:383`、`apps/signal-trader/src/bootstrap-from-env.ts:430` - 当前 dummy backend 通过同一 terminal 同时暴露 `VEX/ListCredentials` marker 与 account-bound `SubmitOrder` / `CancelOrder` / `QueryPendingOrders` / `QueryAccountInfo`，而后续 submit/cancel/query 全链路都使用已持久化、已校验的 `service_id`，与现有 route proof 假设兼容；但这个 marker 只能证明“接口形状存在”，不能证明“它真是 VEX”。建议继续把该路径严格限定为本地测试桩，不要把这套 marker 语义外溢到共享环境或生产 profile。
- `apps/signal-trader/dev/dummy-live-backend.js:52`、`apps/signal-trader/dev/dummy-live-backend.js:62`、`apps/signal-trader/src/bootstrap-from-env.ts:114` - 本轮未见明显注入风险：请求文件写入仅发生在 dummy backend，本地 compose 默认挂载到独立目录；SQL `"order"` 写入值经 `escapeSQL(...)`，表名在 app 侧也受标识符白名单校验。非阻塞风险主要是信息暴露与资源耗尽：`requests.ndjson` / `state.json` 会持续累积 account_id、product_id、order_id 等联调数据，且无轮转/保留上限。建议把该目录视为测试敏感产物，补充清理/保留说明，并避免挂到共享宿主路径。
- `apps/signal-trader/README.md:160`、`apps/signal-trader/GUIDE.md:285` - 文档总体足够清楚：README 已明确“不启动 VEX、只验证请求流”，GUIDE 进一步明确“这只是测试桩，不是模拟真实交易行为”。建议把 GUIDE 里的这句强提示同步到 README dummy 小节，降低只读 README 的误解概率。
- `apps/signal-trader/dev/docker-compose.live-dummy.yml:31`、`apps/signal-trader/dev/run-local-live-dummy-stack.sh:142` - dummy profile 仍要求 `HOST_TOKEN`，这对当前“默认入口同 Host 互信、但 Host 控制面最小保护仍要存在”的模型是合理的。建议继续保留，不要为了测试便利移除。

## 修复指导

- 本轮无 blocker，无需阻塞交付。
- 若后续希望让 dummy profile 拥有更强的防伪语义，建议新增专用 backend key / marker，并在文档中明确它仅用于测试环境，而不是继续复用 `VEX/*` 身份标记去暗示真实执行层身份。
- 若后续要把 dummy profile 分享给更多人使用，建议补充日志清理 runbook，并显式说明 `requests.ndjson` / `state.json` / SQL `"order"` 仅用于联调证据，不可作为真实成交或合规审计依据。

## 复核结论说明

- `apps/signal-trader/src/bootstrap-from-env.ts:138` 到 `apps/signal-trader/src/bootstrap-from-env.ts:187` 要求同一 terminal 同时满足 `VEX/ListCredentials` marker 与 account-bound 服务 schema；`apps/signal-trader/src/bootstrap-from-env.ts:212` 到 `apps/signal-trader/src/bootstrap-from-env.ts:257` 会在 runtime metadata 中校验并复用已验证 route proof；`apps/signal-trader/src/bootstrap-from-env.ts:381` 到 `apps/signal-trader/src/bootstrap-from-env.ts:437` 的 submit/cancel/query 均只走已验证 `service_id`。因此 dummy backend 采用“marker + account-bound 服务同进程暴露”的方式，和当前 route proof 设计兼容，未发现新的状态机/协议绕过 blocker。
- `apps/signal-trader/dev/dummy-live-backend.js:62` 到 `apps/signal-trader/dev/dummy-live-backend.js:109` 对 SQL `"order"` 的写入使用 `escapeSQL(...)`；`apps/signal-trader/src/bootstrap-from-env.ts:114` 到 `apps/signal-trader/src/bootstrap-from-env.ts:119` 对表名做了白名单校验；当前未见明显 Tampering blocker。风险主要转为本地联调数据泄露与日志无限增长，属于非阻塞加固项。
- `apps/signal-trader/README.md:162` 到 `apps/signal-trader/README.md:182` 已把 dummy profile 描述为“只验证请求流、不启动真实 VEX”；`apps/signal-trader/GUIDE.md:293` 到 `apps/signal-trader/GUIDE.md:298` 进一步明确“这是测试桩，不是模拟真实交易行为”。文档已达到本轮“不要误导成真实交易”的最低清晰度要求。
- 结论：本轮 dummy live 测试链路未发现需要阻塞交付的 Spoofing / Tampering / Repudiation / Information Disclosure / DoS / EoP blocker；当前结论为 PASS。
