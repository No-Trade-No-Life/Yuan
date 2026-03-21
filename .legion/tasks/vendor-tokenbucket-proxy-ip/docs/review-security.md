# 安全审查报告

## 结论

PASS

- 已按已确认前提重审：`host` 内 terminal 默认互信；删除 `terminal_id` allowlist 属于设计目标；`ip_source === 'http-services'` 仅是数据有效性/来源提示，不是安全边界。
- 已接受的前提内风险：同一 `host` 网络中的任一 `HTTPProxy` terminal 一旦可见，即可参与同 IP 等价类路由与限流；这不再视为 Spoofing/EoP 缺陷，而是既定信任模型的一部分。
- 仍然存在的 residual risk：审计链路对“最终命中的 proxy terminal”可见性不足、`http-proxy` 默认未收紧 `allowedHosts`、以及 `hostname`/`ip_source` 等字段仍可能被误用为未来的隐式 trust boundary。

## 阻塞问题

- 本轮在既定信任模型下未发现 blocking issue。

## 建议（非阻塞）

- [ ] `[STRIDE:Repudiation]` `apps/vendor-binance/src/api/client.ts:215` - 代理请求只带 `labels.ip`，而 `libraries/http-services/src/__tests__/integration.test.ts:218` 已明确同 IP 多 terminal 可随机命中任一 proxy。该行为在“host 内互信”前提下可接受，但调用侧目前拿不到“实际服务该请求的 terminal/service 标识”，事后定位异常出口、复盘限流抖动或归因单节点故障会较难。建议在代理响应或观测链路中补充实际命中 terminal/service 维度，并把它限制在日志/指标用途，不回流为路由或授权条件。
- [ ] `[STRIDE:Information Disclosure/Denial of Service]` `apps/http-proxy/src/index.ts:32` - 当前 `provideHTTPProxyService` 启动时未显式设置 `allowedHosts`，而服务端实现允许在未配置时放行任意目标主机（`libraries/http-services/src/server.ts:152`）。这在受控单租户 host 内可运行，但 secure-by-default 偏弱：一旦可信域内终端被误用或被攻陷，代理可被拿去访问更广的目标面。建议部署侧默认配置显式 egress allowlist，至少按 vendor 域名或网段收口，并对空 `allowedHosts` 增加告警。
- [ ] `[STRIDE:Tampering/Spoofing]` `libraries/http-services/src/proxy-ip.ts:176` - `tags.ip` + `ip_source === 'http-services'` 现在只适合做数据有效性过滤，不能表达“授权可信代理”。当前实现与 RFC 已基本一致；建议继续在 RFC/部署文档中把这一定性写死，避免后续把 `ip_source` 重新升级成 trust boundary，或把“helper 注入过”误解为“已认证”。
- [ ] `[STRIDE:Repudiation]` `apps/http-proxy/src/index.ts:25` - `hostname` 仍被注册为 service label。它可以作为观测维度或手工排障时的 routing hint，但不应被任何 helper、vendor 或策略逻辑重新解释为身份、租户或授权边界。建议在文档中明确：`hostname` 仅用于观测/缓存/人工排障，不用于 trust decision。
- [ ] `[STRIDE:Denial of Service]` `libraries/http-services/src/proxy-ip.ts:176` - 当前按 IP 去重、按 bucketKey 指纹冲突做有界缓存、按 terminal 维护有界 RR cursor，整体 DoS 面较可控；但仍建议补监控：同 IP 对应 terminal 数量、空池/超时、`bucket_options_conflict_total`、route 阶段 `E_PROXY_TARGET_NOT_FOUND`、以及同 IP 下 terminal 命中分布，用于发现异常注册、单节点抖动或缓存陈旧。
- [ ] `[STRIDE:Dependency Risk]` `libraries/http-services/src/proxy-ip.ts` - 本次 scope 未引入新依赖，也未修改 lockfile / package manifest，因此未发现由本次变更新增的依赖/CVE blocker；但仓库级依赖健康不在本次变更证据范围内，不能据此给出全仓依赖安全背书。

## 修复指导

- 已由“host 内互信”前提接受的风险：
  - `terminal_id` 不再作为 allowlist、稳定身份或 route pin；同 host 网络内的 proxy terminal 默认互信。
  - 同 IP 多 terminal 被视为同一个出口等价类；随机命中任一 terminal 不再视为安全缺陷。
  - “某 terminal 伪造 `terminal_id` / 复用同 IP 加入候选池”只在 host 网络不可信时才成立；在本次前提下属于前提外风险，不作为 blocking。
- 仍然是 residual risk 的事项：
  - 审计不足：请求侧缺少“最终命中的 proxy terminal/service”观测，影响归因与追溯。
  - secure-by-default 不足：`allowedHosts` 默认放开，依赖部署环境自律或外部 ACL。
  - 概念漂移风险：`terminal_id`、`hostname`、`ip_source` 若在未来再次进入 helper 返回值、授权判断或自动路由 pin，会重新引入错误 trust boundary。
- 哪些依赖只适合做观测/缓存，不应升级为 trust boundary：
  - `terminal_id`：`libraries/http-services/src/proxy-ip.ts:95`、`libraries/http-services/src/proxy-ip.ts:279`、`apps/vendor-binance/src/api/client.ts:19`、`apps/vendor-binance/src/api/client.ts:213` 等仅适合做 RR 游标缓存、日志限频键、指标标签、诊断上下文。
  - `hostname`：`apps/http-proxy/src/index.ts:25` 只适合做观测标签或人工排障 hint，不应用于授权、租户隔离、可信代理身份判定。
  - `ip_source`：`libraries/http-services/src/proxy-ip.ts:180`、`apps/http-proxy/src/index.ts:19` 只适合做“标签来自 helper/格式已校验”的数据有效性提示，不应用于认证、授权或可信代理判定。
- 若未来部署前提变化为“host 网络不再完全互信”，则当前设计会立刻退化为前提外高风险模型；那时应新增 host 接入鉴权、签名标签、mTLS 或更高层网络隔离，而不是恢复 `terminal_id` allowlist 作为补丁式安全边界。

[Handoff]
summary:

- 已基于用户确认的 host 内互信前提完成只读安全复审。
- 结论调整为 PASS：旧版“必须恢复 allowlist/身份绑定”的结论已降级为前提外风险。
- 已明确 `terminal_id`、`hostname`、`ip_source` 仅适合观测/缓存/诊断，不应再升级为 trust boundary。
  decisions:
- (none)
  risks:
- 调用侧缺少实际命中 proxy terminal 的审计维度，异常归因能力有限。
- `http-proxy` 默认未收紧 `allowedHosts`，secure-by-default 偏弱。
- 若未来 host 网络不再可信，当前模型会退化为前提外高风险设计。
  files_touched:
- path: /Users/c1/Work/http-proxy-whitelist/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md
  commands:
- (none)
  next:
- 为 proxy 响应链路补充实际命中 terminal/service 的观测字段。
- 在部署或运行文档中明确 `allowedHosts` 的推荐收口策略与空配置告警。
- 在 RFC/代码注释中固化 `terminal_id` / `hostname` / `ip_source` 的非信任边界定位。
  open_questions:
- (none)
