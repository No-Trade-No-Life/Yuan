# Security Review Report

## 结论

FAIL

## Blocking Issues

- [ ] `apps/node-unit/src/index.ts:249` [Tampering / Elevation of Privilege / Repudiation] - assignment 续租与 `exit_reason` 写回只校验 `assignment_id + deployment_id + node_id`，没有使用可变更的 fencing token / incarnation token。当前 `lease_holder` 也等于稳定的 `node_id`，导致同一节点上的陈旧子进程在 lease 过期并被重新分配后，仍可能继续续租或覆盖新实例的 `exit_reason`。风险场景：旧进程卡死后未真正退出，调度器回收并把同一 assignment 再次分配给同一节点，旧进程的晚到 heartbeat 会劫持新 lease，造成 stale code 持续运行、审计失真或阻断回滚。

## Major Issues

- [ ] `apps/node-unit/src/scheduler.ts:86` [Tampering / Denial of Service] - feature flag 切换目前只依赖本地环境变量 `NODE_UNIT_ASSIGNMENT_FEATURE_FLAG`，node 侧仅上报 `terminalInfo.tags.applied_generation`，但本次实现范围内没有持久化 `switch_state` / `target_generation` / `cohort_snapshot`。风险场景：节点配置漂移、手工切换或恶意修改 env 后，可绕过全局收敛门禁，出现部分节点走 assignment、部分节点走 address 的 split-brain；回滚时也无法证明全体节点已收敛到单一路径。
- [ ] `tools/sql-migration/sql/deployment.sql:42` [Tampering / Denial of Service] - `desired_replicas`、`selector`、`lease_ttl_seconds`、`heartbeat_interval_seconds` 仅在应用层做宽松归一化，没有数据库 `CHECK` 约束、上限控制或语义校验。风险场景：异常/恶意 SQL 写入可设置超长 lease（长期占坑、阻断回收/回滚）、超短 heartbeat（放大数据库写压力）、超长 selector（日志/内存放大），调度器会接受这些值并执行。

## 安全建议（非阻塞）

- `apps/node-unit/src/index.ts:672` [Denial of Service / Information Disclosure] - `Deployment/RealtimeLog` 为每个订阅直接 `spawn('tail', ['-F', logPath])`，未见并发上限、订阅鉴权或速率限制。若 Terminal 访问面较宽，攻击者可通过大量订阅耗尽文件句柄/进程数，并持续读取运行时错误输出。
- `apps/node-unit/src/scheduler.ts:98` [Tampering] - selector 解析只在调度阶段做语法判断，重复 key 会被静默覆盖，且持久层没有约束。建议在写入侧做“拒绝重复 key + 长度上限 + 预编译校验”，避免策略被歧义输入绕过。

## 修复指导

1. 为 assignment 引入真正的 fencing token：每次调度/重分配生成新的 `lease_epoch` 或随机 `lease_holder_token`，heartbeat 与 `exit_reason` 写回必须同时校验 `assignment_id + token + state + lease_expire_at >= db_now`；node 侧运行时要持有该 token，旧进程不得仅凭 `node_id` 续租。
2. 将 feature flag 切换改为持久化状态机：新增 `switch_state`（至少包含 `switch_id`、`target_generation`、`cohort_snapshot`、`deadline`、`status`），scheduler 与 executor 都只读取该真值；禁止仅靠本地 env 决定模式，env 最多作为 bootstrap/default。
3. 在 `deployment` 表增加数据库约束：`desired_replicas >= 1`、`lease_ttl_seconds`/`heartbeat_interval_seconds` 的上下界、`selector` 长度上限与基础格式约束；对越界值直接拒绝写入而不是静默回退默认值。
4. 为日志读取/实时日志增加访问边界：限制订阅并发数、增加服务端授权判断、设置单节点总 tail 进程上限，并避免把原始 stderr 无差别透传给低权限调用方。

## 剩余攻击面 / 运维风险

- 当前最大剩余风险是“同节点陈旧进程 + 非持久化切换”的组合：它会把原本的 lease/fencing 语义降级成 best-effort，切换窗口更容易出现双路径并存、假续租和回滚不收敛。
- 运行面仍依赖数据库写入质量；若控制面或手工 SQL 能直接改 `deployment` / `deployment_assignment`，缺少表级约束会把配置错误直接放大成调度故障。
- 子进程与日志面仍需要单独做资源治理，否则在故障放大或恶意订阅下容易先打满本机句柄/进程数，再诱发 node-unit 自身不稳定。
