# RFC: Proxy IP TokenBucket v2（去除 terminal_id 信任边界）

状态: Draft（增量修订）
目标文件: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
日期: 2026-03-21
风险分级: Medium

## 摘要 / 动机

本次修订收敛 HTTPProxy 的信任模型：`terminal_id` 不再被视为稳定身份，也不得再作为 HTTPProxy 白名单或路由 pin 的依据。同一 host 网络中可见的 `HTTPProxy` terminal 默认互信；请求仅按 `labels.ip` 选择出口，token bucket 也仅按 `encodePath([baseKey, ip])` 隔离。

动机有三点：

1. `terminal_id` 不稳定，继续把它当作 trust boundary 会导致配置漂移、误拒绝、回滚复杂度升高。
2. 当前限流与实际出口已经以 `ip` 为核心维度；继续把 `terminal_id` 混入 helper 返回值和请求标签，只会制造“同一出口、不同身份”的伪差异。
3. 用户最新要求已经明确：同一 host 网络内所有 terminal 默认互信，因此信任边界应上移到 host 网络/接入面，而不是终端自报的 `terminal_id`。

结论：本 RFC 将 v2 方案改为“host 内默认互信 + IP 维度选路/限流”，并显式删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 相关设计与实现。

## 目标与非目标

### 目标

- 代理模式下，helper MUST 仅基于同 host 网络中可见的 `HTTPProxy` 服务、合法 `tags.ip`、可信 `ip_source` 生成候选池。
- helper MUST 不再读取、解析、缓存或依赖 `TRUSTED_HTTP_PROXY_TERMINAL_IDS`。
- `libraries/http-services/src/proxy-ip.ts` 内所有导出的 HTTPProxy 候选枚举/选择 helper MUST 统一复用同一个“host 内默认互信 + 合法 `ip` + `ip_source=http-services` + IP 去重”候选构造逻辑。
- helper 返回值 MUST 从 `{ ip, terminalId, bucketKey }` 收敛为 `{ ip, bucketKey }`。
- vendor 请求路由 MUST 只写入 `labels.ip`，MUST NOT 再写入 `labels.terminal_id`。
- `apps/http-proxy` 服务注册 MUST 删除 `labels.terminal_id`；不得继续暴露 terminal 级 route pin 能力。
- 同一 host 网络内多个 terminal 共享同一出口 IP 时，MUST 视为同一个限流/路由等价类。
- RFC 必须明确回答：后续不应继续在请求 `labels` 或 helper 返回值中使用 `terminal_id` 充当 trust boundary 或稳定身份。

### 非目标

- 不修改 `tokenBucket` 底层算法、`acquireSync` 语义和 semaphore 实现。
- 不改造协议层 `terminal_id` 作为消息寻址字段的既有职责。
- 不在本次 scope 内引入新的 host 级鉴权、mTLS 或网络分区机制。
- 不扩大到所有 vendor 的立即实现；本次落地范围仍以 `http-services`、`http-proxy`、`vendor-binance` 为主。

## 定义

- `Host 网络`: 同一个 Terminal Host 视图内可见、可被当前 terminal 枚举到的终端集合。
- `HTTPProxy 候选`: 同 host 网络内声明了 `HTTPProxy` 服务，且 `tags.ip` 为合法 IP、`tags.ip_source === 'http-services'` 的 terminal。
- `IP 等价类`: 具有相同 `tags.ip` 的一个或多个 `HTTPProxy` terminal；调度和限流只看 IP，不区分 terminal。
- `BaseKey`: vendor 现有的限流基键。
- `BucketKey`: `encodePath([baseKey, ip])`。
- `Stage`: 错误归属阶段，取值 `{pool|acquire|route|request}`。

## 现状与问题

基于当前代码与任务上下文，可确认以下现状：

1. `libraries/http-services/src/proxy-ip.ts` 通过 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 过滤候选 terminal，并把 `terminalId` 放入 `AcquireProxyBucketResult`。
2. `apps/http-proxy/src/index.ts` 会把 `labels.terminal_id = terminal.terminal_id` 注册到服务标签中。
3. `apps/vendor-binance/src/api/client.ts` 在代理模式下把 `{ ip, terminal_id }` 一起写入请求 `labels`，等价于用 `terminal_id` 对相同 IP 的多个代理做二次 pin。

这三处共同构成了当前错误的身份模型：虽然 bucket 已经按 IP 维度工作，但信任准入和路由仍被 `terminal_id` 绑住，导致 `terminal_id` 被误当成稳定身份与 trust boundary。

## 拟议设计

### 1. 信任模型

- 同一 host 网络中的所有 terminal 默认互信。
- `terminal_id` 不再参与 HTTPProxy 候选准入。
- HTTPProxy 候选的最小准入条件收敛为：
  - 提供 `HTTPProxy` 服务；
  - `tags.ip` 为合法 IP；
  - `tags.ip_source === 'http-services'`。

这意味着 trust boundary 从“terminal allowlist”上移为“是否已经进入同一个 host 网络并暴露合法 HTTPProxy 服务”。如果未来需要更细粒度隔离，应在 host 接入层做，而不是恢复 `terminal_id` 白名单。

### 2. 候选池与去重

- helper 从 `terminal.terminalInfos` 枚举全部 `HTTPProxy` terminal。
- 先过滤非法 IP、缺失 `ip_source`、非 `HTTPProxy` 服务。
- 再按 `ip` 去重，得到 `IPPool`。
- 同一 IP 对应多个 terminal 时，helper 只保留一个 IP 候选；不对外暴露 terminal 级身份。
- `listHTTPProxyIps`、`waitForHTTPProxyIps`、`selectHTTPProxyIpRoundRobin`、`selectHTTPProxyIpRoundRobinAsync`、`acquireProxyBucket` 等导出 helper MUST 统一复用这一候选构造逻辑，避免一部分链路去掉 allowlist、另一部分链路仍保留旧 env/cache/log 分支。

理由：

- token bucket 已按 IP 维度隔离；
- 请求路由也只需 `labels.ip`；
- 同一 host 网络内多个 terminal 共享同一出口 IP 时，额外携带 `terminal_id` 只会制造不必要的路由 pin 和身份耦合。

### 3. 调度与请求流程

端到端流程如下：

1. vendor 计算 `baseKey` 与 `weight`，传入 `getBucketOptions(baseKey)`。
2. helper 枚举同 host 网络内全部 `HTTPProxy` 候选，并按 IP 去重得到 `IPPool`。
3. helper 维持现有“可承载组优先”策略：优先尝试 `read() >= weight` 的 IP，再尝试其余 IP。
4. 对每个 IP 候选执行 `acquireSync(weight)`；成功即返回 `{ ip, bucketKey }`。
5. vendor 将返回的 `ip` 写入 `fetch.labels.ip`，不再写入 `labels.terminal_id`。
6. `fetch` 依赖协议层现有 schema 匹配能力，按 `labels.ip` 路由到任一满足该 IP 标签的 `HTTPProxy` 服务。

### 4. 接口收敛

`AcquireProxyBucketResult` 调整为：

```ts
type AcquireProxyBucketResult = {
  ip: string;
  bucketKey: string;
};
```

`IRequestContext` 在代理模式下调整为：

```ts
type IRequestContext = {
  ip: string;
  bucketKey: string;
  acquireWeight: number;
};
```

请求标签调整为：

```ts
labels: {
  ip: proxyIp;
}
```

明确回答：后续不应继续在 helper 返回值或请求 `labels` 中使用 `terminal_id` 作为 trust boundary、稳定身份或路由 pin；若保留 `terminal_id`，只能用于日志、指标、诊断上下文，且不得影响授权、候选筛选或目标选择。

额外 gate：`AcquireProxyBucketResult`、`IRequestContext` 与 `libraries/http-services/etc/http-services.api.md` 对 `terminalId` 的删除 MUST 同次落地、同次验证，禁止出现实现已删但类型/导出面残留，或类型已改但消费方未收敛的半改状态。

### 5. `apps/http-proxy` 标签契约

- 保留 `labels.ip`，因为它是路由键。
- 删除 `labels.terminal_id`，因为它不再承担任何必须语义。
- `labels.hostname` 可保留，仅作为观测维度，不参与信任决策。

### 6. 关于同 IP 多 terminal 的行为

- 同一 IP 下多个 `HTTPProxy` terminal 默认互信。
- 路由命中该 IP 时，允许由协议层随机命中任一匹配 terminal。
- 这不是不确定性 bug，而是新的显式约定：同 IP 代表同一个出口等价类，terminal 级别不是稳定身份。

## 备选方案

### 方案 A：继续保留 `TRUSTED_HTTP_PROXY_TERMINAL_IDS`

- 放弃原因：与“`terminal_id` 不稳定”这一事实正面冲突；每次 terminal 重建/迁移都要更新白名单，运维成本和误配置风险过高。

### 方案 B：改用 `terminal_id + ip` 双因子

- 放弃原因：本质上仍把 `terminal_id` 当成稳定身份，只是把失败模式藏得更深；同时会继续污染 helper 返回值与请求标签。

### 方案 C：引入 host 级显式信任域配置

- 放弃原因：方向上比 terminal allowlist 正确，但超出本次 scope；当前用户已明确接受“同 host 网络默认互信”，无需在此 RFC 中扩成新系统。

本次选择：直接采用“host 内默认互信 + IP 等价类”模型。

## 数据模型与接口

### `AcquireProxyBucketInput`

```ts
type AcquireProxyBucketInput = {
  baseKey: string;
  weight: number;
  terminal: Terminal;
  getBucketOptions: (baseKey: string) => TokenBucketOptions;
};
```

约束：

- `getBucketOptions` 仍是唯一 options 来源；本次修订不改变这一点。
- helper MUST NOT 引入隐式默认 options。
- helper MUST NOT 读取任何 terminal allowlist 环境变量。

### `AcquireProxyBucketResult`

```ts
type AcquireProxyBucketResult = {
  ip: string;
  bucketKey: string;
};
```

兼容策略：

- 删除 `terminalId` 字段，属于有意 API 收敛。
- 所有消费方必须改为只依赖 `ip` 与 `bucketKey`。
- `http-services.api.md` 必须同步更新，避免导出面残留旧身份模型。

### `apps/http-proxy` 服务标签

- MUST 包含 `ip`。
- MAY 包含 `hostname`。
- MUST NOT 包含用于信任/路由 pin 的 `terminal_id`。

## 错误语义

| stage     | 触发条件                                 | 错误码                      | 恢复语义     |
| --------- | ---------------------------------------- | --------------------------- | ------------ |
| `pool`    | host 网络内无可用 `HTTPProxy` IP         | `E_PROXY_TARGET_NOT_FOUND`  | 长退避重试   |
| `acquire` | 所有 IP 候选均无法 `acquireSync(weight)` | `E_PROXY_BUCKET_EXHAUSTED`  | 短退避重试   |
| `acquire` | 同 `bucketKey` options 指纹冲突          | `E_BUCKET_OPTIONS_CONFLICT` | 修配置后重试 |
| `route`   | 仅按 `labels.ip` 路由但无匹配服务        | `E_PROXY_TARGET_NOT_FOUND`  | 长退避重试   |
| `request` | 已路由成功但代理请求失败/上游失败        | `E_PROXY_REQUEST_FAILED`    | 按既有策略   |

补充约束：

- `SEMAPHORE_INSUFFICIENT_PERMS` 仍映射为 acquire 阶段的可恢复失败。
- 删除 allowlist 后，`empty_pool` 不再包含“白名单为空”这一原因分支，只保留“当前 host 视图中无可用 proxy IP”。

## 安全考虑

### 结论

风险分级为 Medium。

理由：

1. 变更会扩大同 host 网络内默认可用的 proxy 范围，从“显式 allowlist”变为“host 内默认互信”。
2. 但实际 trust boundary 已由用户明确上移到 host 网络，本次只是让实现与该模型对齐；影响面主要集中在 `http-services`/`http-proxy`/`vendor-binance`。
3. 现有安全控制仍保留两道最小约束：必须是 `HTTPProxy` 服务，且 `tags.ip`/`ip_source` 必须合法。

安全要求：

- MUST 校验 `tags.ip` 为合法 IP，非法值不得进入候选池。
- MUST 校验 `tags.ip_source === 'http-services'`，避免把未注入或脏标签当作路由键。
- MUST 对 IP 候选按 `ip` 去重，避免通过 terminal fan-out 放大 bucket cardinality。
- MUST NOT 以 `terminal_id` 作为授权、白名单、路由 pin 或稳定身份。
- SHOULD 在文档中明确：若未来需要隔离不同代理租户，必须在 host 级接入面做隔离，而不是恢复 terminal allowlist。

## 向后兼容、发布与回滚

### 向后兼容

- `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 从本次开始失效并从实现中删除。
- `AcquireProxyBucketResult.terminalId` 删除，属于编译期可发现的不兼容变更。
- 代理请求不再发送 `labels.terminal_id`；只要 `HTTPProxy` 服务按 `labels.ip` 路由，行为即保持可用。

### 发布步骤

1. 先修改 `http-services`：删除 allowlist 与 `terminalId` 返回值，更新 API report 与单测。
2. 再修改 `apps/http-proxy`：移除服务标签中的 `terminal_id`。
3. 最后修改 `apps/vendor-binance`：请求上下文与 `fetch.labels` 只保留 `ip`。

### 回滚策略

- 若新逻辑出现异常，回滚到上一个 commit/版本；不再保留运行时开关恢复 terminal allowlist。
- 回滚判据：`E_PROXY_TARGET_NOT_FOUND` 异常升高且排查确认为 host 网络内标签/路由不一致，而非容量耗尽。

## 验证计划

关键行为到测试/验收的映射如下：

- `V1` 删除 allowlist 后，只要同 host 网络内存在合法 `HTTPProxy` + `ip_source=http-services` + 合法 `ip`，helper 就能拿到候选池。
- `V2` `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 即使设置，也不会影响候选结果。
- `V3` helper 返回值不再包含 `terminalId`，API report 同步收敛。
- `V4` vendor 代理请求只携带 `labels.ip`，不再携带 `labels.terminal_id`。
- `V5` 同 IP 多 terminal 时，helper 只生成一个 `bucketKey`，不会因 terminal 数量放大 bucket。
- `V6` 同 IP 多 terminal 时，请求只带 `labels.ip` 仍可成功路由到任一匹配代理。
- `V7` 可承载组优先、失败切换、空池、全失败、options 冲突等旧 v2 行为保持不变。
- `V8` `apps/http-proxy` 不再注册 `labels.terminal_id`；若仅按 `labels.ip` 路由无匹配，错误必须落到 `stage=route` / `E_PROXY_TARGET_NOT_FOUND`。

建议最小测试集合：

1. `proxy-ip.test.ts`
   - 删除“allowlist 为空 fail-closed”断言。
   - 新增“环境变量存在但被忽略”断言。
   - 新增“同 IP 多 terminal 去重后只创建一个 bucket”断言。
   - 新增“所有导出 helper 统一忽略 allowlist/env 分支”的等价覆盖。
2. `client`/vendor 测试
   - 断言代理请求只传 `labels.ip`。
   - 断言 `IRequestContext` 不再暴露 `terminalId`。
   - 断言 `apps/http-proxy` 服务标签不再包含 `terminal_id`。
   - 新增最小 route 验收：两个 `HTTPProxy` terminal 共享同一 IP 时，请求仅带 `labels.ip` 仍可成功；若 `labels.ip` 无匹配，则返回 `stage=route` / `E_PROXY_TARGET_NOT_FOUND`。
3. 构建验收
   - `libraries/http-services` 单测通过。
   - `apps/vendor-binance` 构建通过。

## 开放问题

1. 当前保留 `ip_source === 'http-services'` 作为最小标签可信信号；若未来同样被证明不够稳定，需另起 RFC 讨论 host 级签名/鉴权方案。
2. 同 IP 多 terminal 的随机命中是否需要额外 observability（如命中 terminal 分布）？本次不是阻塞项。

## 落地计划

### 文件变更点

- `libraries/http-services/src/proxy-ip.ts`
  - 删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 常量、缓存、解析与 allowlist 过滤。
  - 将候选池逻辑改为“host 内全部 HTTPProxy terminal + IP 去重”，并抽成统一候选构造函数供全部导出 helper 复用。
  - 删除 `AcquireProxyBucketResult.terminalId`。
- `libraries/http-services/src/client.ts`
  - 文档与接口注释更新为“路由依赖 `labels.ip`，不依赖 `labels.terminal_id`”。
- `libraries/http-services/src/index.ts`
  - 仅确认导出面与收敛后的类型一致。
- `libraries/http-services/src/__tests__/proxy-ip.test.ts`
  - 删除 allowlist 相关测试；补充“env 被忽略”“同 IP 去重”测试。
- `libraries/http-services/src/__tests__/client.test.ts`
  - 维持 route/request 错误阶段断言，并确认请求标签仅包含 `ip`。
- `libraries/http-services/src/__tests__/integration.test.ts`
  - 补充“同 IP 多 terminal 时仅按 `labels.ip` 仍可成功路由”的最小自动化验收。
- `libraries/http-services/etc/http-services.api.md`
  - 删除 `AcquireProxyBucketResult.terminalId`。
- `apps/http-proxy/src/index.ts`
  - 删除 `labels.terminal_id` 注入，并把“服务标签仅保留 `ip`/`hostname` 观测维度”作为硬验收。
- `apps/vendor-binance/src/api/client.ts`
  - 删除 `IRequestContext.terminalId`。
  - 删除对 `AcquireProxyBucketResult.terminalId` 的消费。
  - 代理请求标签只保留 `{ ip }`。

### 最小验证步骤

1. 跑 `libraries/http-services` 单测，确认去 allowlist 后候选池/去重/旧错误语义仍通过。
2. 跑 `apps/vendor-binance` 构建，确认类型收敛没有残留 `terminalId` 依赖。
3. 自动化验证：两个同 host 的 `HTTPProxy` terminal 共享同一 IP 时，请求只带 `labels.ip` 仍可成功；若无匹配，必须得到 `stage=route` / `E_PROXY_TARGET_NOT_FOUND`。
4. 如有条件，再做一次本地 smoke：确认任一 terminal 可被路由命中且 bucketKey 仍只按 IP 维度变化。

## 发现的类似 `terminal_id` 依赖与处置建议

以下位置仍把 `terminal_id` 放在 HTTPProxy 相关链路中，应在本次实现内一并收敛或至少明确不再承担 trust 语义：

1. `apps/http-proxy/src/index.ts`
   - 当前把 `terminal.terminal_id` 注入服务 `labels.terminal_id`。
   - 处置建议：删除该标签；保留 `hostname` 作为观测即可。
2. `apps/vendor-binance/src/api/client.ts`
   - 当前消费 helper 返回的 `terminalId`，并把它写入请求 `labels.terminal_id`。
   - 处置建议：删除 `terminalId` 字段与对应标签，只按 `labels.ip` 路由。
3. `libraries/http-services/src/proxy-ip.ts`
   - 当前以 allowlist 和返回值形式把 `terminal_id` 用作候选准入与稳定身份。
   - 处置建议：本次直接删除；后续 `terminal_id` 仅允许用于日志、指标、缓存命名空间，不得进入 trust decision。

以下位置也出现 `terminal_id`，但本次判断不属于“trust boundary/稳定身份”问题，可暂不改：

- `libraries/http-services/src/proxy-ip.ts` 中以 `terminal.terminal_id` 区分本地缓存命名空间或日志上下文；这类用途不参与授权与路由，可保留。
- 协议层 `libraries/protocol/*` 中的 `terminal_id` 仍是消息寻址字段，不在本 RFC 调整范围。
