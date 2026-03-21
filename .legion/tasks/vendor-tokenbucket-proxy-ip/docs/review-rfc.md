# RFC 审查报告

目标文档: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
审查日期: 2026-03-21
审查原则: 奥卡姆剃刀（复核上一轮 4 个 blocking 是否已用最小复杂度闭环）

## 结论

PASS

本轮只读复审确认：上一轮提出的 4 个 blocking 已全部闭环，当前 RFC 已满足可实现、可验证、可回滚的设计门槛。

## 闭环复核

### 1. 所有导出 helper 统一 trust model

- 已闭环。
- RFC 在目标与“候选池与去重”两处都明确要求：`libraries/http-services/src/proxy-ip.ts` 内所有导出的 HTTPProxy 候选枚举/选择 helper 必须统一复用同一个“host 内默认互信 + 合法 ip + ip_source=http-services + IP 去重”的候选构造逻辑，不允许部分链路继续保留 allowlist/env/cache/log 分支。参见 `rfc.md:26`、`rfc.md:78`、`rfc.md:290`。

### 2. 删除 `apps/http-proxy` 的 `labels.terminal_id` 已写成硬门槛

- 已闭环。
- RFC 已把该要求从正文偏好升级为 MUST，并写入目标、标签契约、验证计划与文件变更点，形成独立验收门槛。参见 `rfc.md:29`、`rfc.md:194`、`rfc.md:261`、`rfc.md:301`。

### 3. `AcquireProxyBucketResult` / `IRequestContext` / API report 的 `terminalId` 收敛已写成同改同验 gate

- 已闭环。
- RFC 新增了明确 gate：三处删除 `terminalId` 必须同次落地、同次验证，禁止半改状态；同时在验证计划与文件变更点中都有对应落点。参见 `rfc.md:126`、`rfc.md:186`、`rfc.md:256`、`rfc.md:299`、`rfc.md:303`。

### 4. 新增了最小自动化 route 验收

- 已闭环。
- RFC 已把“两个 `HTTPProxy` terminal 共享同一 IP 时，仅带 `labels.ip` 仍可成功；无匹配时返回 `stage=route` / `E_PROXY_TARGET_NOT_FOUND`”写入验证计划、建议测试集合与最小验证步骤，不再只是 smoke 建议。参见 `rfc.md:259`、`rfc.md:261`、`rfc.md:274`、`rfc.md:311`。

## 结论说明

- 当前文本已经把旧 trust model 的关键残留点都收敛成硬约束，而不是实现者自行理解。
- 没有新增不必要抽象；修订都集中在 scope 内现有 helper、标签契约、类型导出和测试门槛，复杂度增量可接受。
- 本轮无新增 blocking。
