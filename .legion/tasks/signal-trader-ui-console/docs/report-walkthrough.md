# signal-trader-ui-console 交付 walkthrough

## 目标与范围

- **目标**：在 `ui/web` 新增一个可直接打开的 `SignalTraderConsole` 页面，支持选择 runtime、查看 health / projection / event / audit，并在受控门禁下手工提交 `-1 / 0 / 1` signal。
- **绑定 scope**：
  - `ui/web/**`
  - `apps/signal-trader/**`
  - `docs/zh-Hans/packages/@yuants-ui-web.md`
  - `apps/signal-trader/GUIDE.md`
- **本次明确新增**：
  1. `SignalTraderConsole`
  2. `SignalTrader/QueryRuntimeAuditLog`

## 设计摘要

- 设计基线见 RFC：[`rfc.md`](./rfc.md)
- 设计审查见：[`review-rfc.md`](./review-rfc.md)
- 本次实现延续 RFC 的三个核心约束：
  - **服务优先**：runtime/config/health/projection/event/audit 全部通过 `SignalTrader/*` 服务读取，不再让 GUI 复用通用 SQL 直读 audit。
  - **fail-close**：任一前置条件未知、失败、过期或无权限时，一律禁用写操作，不做“尽量提交”。
  - **live submit gate**：live 提交必须同时满足 config 已加载、health 正常、页面无 loading/error/stale、提交前再次读取 health 仍为 normal、并手工输入 `runtime_id` 确认。

## 改动清单（按模块 / 文件）

### 1. `ui/web`：新增 signal-trader 控制台页面

- `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx`
  - 新增页面注册 `SignalTraderConsole`
  - 新增 6 个核心区块：runtime selector、status、submit、projection、event stream、audit log
  - 读取链路统一调用：
    - `SignalTrader/ListRuntimeConfig`
    - `SignalTrader/GetRuntimeHealth`
    - `SignalTrader/QueryProjection`
    - `SignalTrader/QueryEventStream`
    - `SignalTrader/QueryRuntimeAuditLog`
  - 写入链路继续调用 `SignalTrader/SubmitSignal`
  - `live submit gate / fail-close` 关键行为已落地：
    - 只要存在 `loading` / `read error` / `stale` / runtime 未启用 / health 非 `normal`，提交按钮即禁用
    - 提交前会重新读取一次 `GetRuntimeHealth`
    - 若 recheck 结果非 `normal` 或已 stale，则直接阻断提交
    - live runtime 额外要求手工输入当前 `runtime_id` 二次确认
    - `metadata` 在前端被限制为 JSON object，且体积不超过 4000 字符
  - 页面内补了最小 observability：`submit_blocked`、`submit_attempted`、`submit_succeeded`、`submit_rejected`
- `ui/web/src/modules/SignalTrader/index.ts`
  - 新增模块入口，注册页面。

### 2. `apps/signal-trader`：新增 audit 只读服务

- `apps/signal-trader/src/types.ts`
  - 新增 `QueryRuntimeAuditLogRequest` / `QueryRuntimeAuditLogResponse` 类型。
- `apps/signal-trader/src/runtime/runtime-manager.ts`
  - 新增 `queryRuntimeAuditLog(req)`
  - 当前实现按 `runtime_id` 查询 audit log，限制 `limit` 在 `1..200`
  - 对 `note` / `evidence` / `detail` 做文本截断与深度裁剪，避免 GUI 直接拿到底层原始大对象
- `apps/signal-trader/src/services/signal-trader-services.ts`
  - 新注册只读服务 `SignalTrader/QueryRuntimeAuditLog`
  - 读权限统一走 `authorizeRead`
  - 继续保持 mutating services 需显式授权的 secure-by-default 行为

### 3. 文档更新

- `apps/signal-trader/GUIDE.md`
  - 补充 GUI 集成说明
  - 明确仓库已提供 `SignalTraderConsole`
  - 明确 audit log 读取应走 `SignalTrader/QueryRuntimeAuditLog`
- `docs/zh-Hans/packages/@yuants-ui-web.md`
  - 补充 `SignalTrader` 模块说明
  - 明确该页面在最小 fail-close 门禁下支持手工提交 signal

## 如何验证

- 详细测试记录见：[`test-report.md`](./test-report.md)

### 已执行命令

1. `npm run build`（工作目录：`apps/signal-trader`）
   - **预期**：Heft build 完成，测试通过
   - **结果**：通过
2. `npm run build`（工作目录：`ui/web`）
   - **预期**：前端 TypeScript / build 通过
   - **结果**：未通过，但阻塞点是仓库既有 workspace 依赖解析问题，不直接指向本次 signal-trader 新模块

### 结论化验证结果

- `apps/signal-trader` build 通过
- `ui/web` build 被仓库既有问题阻塞
- 从当前报错归因看，新增 `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx` 未出现在本轮 TypeScript 报错列表中

## 风险与回滚

### 已知风险

- **audit DTO 白名单仍需继续收紧**：`detail` 当前仍是“整对象透传后裁剪”的思路，历史 operator/audit 上下文字段仍可能被 GUI 用户看到过多细节。
- **repository 层分页尚未下推**：`QueryRuntimeAuditLog` 当前仍是先按 runtime 取回再内存裁剪，长期存在响应放大与资源消耗风险。
- **metadata 后端限制仍待补齐**：当前 JSON object / 4000 字符限制主要在前端；直接调用服务仍可能绕过 UI 限制。
- **前端 stale 语义与后端 health 语义仍有漂移风险**：当前 UI 仍基于 `poll_interval_ms * 3` 推导 stale，但关键 live recheck 已补上，短期可接受。

### 回滚方式

1. **UI 回滚**：隐藏或移除 `SignalTraderConsole` 页面入口。
2. **权限回滚**：撤销宿主对 `SignalTrader/SubmitSignal` 的 live 写权限，页面自动退化为只读。
3. **服务回滚**：如需进一步收缩读取面，可临时下线 `SignalTrader/QueryRuntimeAuditLog`，保留其余只读能力。

## 未决项与下一步

- 将 `QueryRuntimeAuditLog` 收敛为更稳定的 action-specific DTO / 子字段白名单。
- 将 audit log 分页与窗口限制前推到 repository / SQL 层，而不是全量取回后内存裁剪。
- 在后端为 `SubmitSignal.command.metadata` 增加类型、大小、深度上限校验，并返回稳定错误码。
- 若后端后续提供更明确的 freshness / stale 字段，前端应直接消费，避免继续维护本地推导规则。

## 相关链接

- Plan：[`../plan.md`](../plan.md)
- RFC：[`./rfc.md`](./rfc.md)
- RFC 审查：[`./review-rfc.md`](./review-rfc.md)
- 测试报告：[`./test-report.md`](./test-report.md)
- 代码审查：[`./review-code.md`](./review-code.md)
- 安全审查：[`./review-security.md`](./review-security.md)
