# RFC：signal-trader 正式价格源切换到 SQL QUOTE 表

## 背景 / 问题

当前 internal netting 在 `libraries/signal-trader/src/engine/dispatch-command.ts` 中仅在 `command.entry_price` 存在时生成 `MidPriceCaptured`，并把 `source` 固定写成 `submit_signal.entry_price`。这意味着正式价格证据来自 submit payload，而不是系统内可追溯、可独立验证的行情真相。

仓库已经存在标准 SQL `QUOTE` 表（`tools/sql-migration/sql/quote.sql`），其主键为 `(datasource_id, product_id)`，并维护 `updated_at`。该表已经具备承担“当前正式价格证据源”的条件，但 `signal-trader` 目前尚未读取，也没有把 quote 证据通过 app/core 边界显式传入事件链。

如果继续把 `entry_price` 兼作 internal netting 的正式价格真相，会带来三类问题：

- 审计问题：价格证据来自外部提交者，而非系统内标准行情表。
- 语义问题：`entry_price` 既承担 sizing 输入，又承担 netting 真相，职责混淆。
- 演进问题：后续 realized/unrealized PnL、资本归因、异常排障都无法稳定指向同一证据源。

因此，本 RFC 约束：正式价格源必须直接参考 SQL `QUOTE` 表；core 不直接触 SQL，由 app 注入 quote provider；quote 缺失时 internal netting fail-close，不再偷偷回退到 `entry_price`。

## 目标与非目标

### 目标

- 将 internal netting 的正式价格证据切换为 SQL `QUOTE` 表。
- 保持 `libraries/signal-trader` 的纯 domain / event-sourcing 边界，SQL 访问仅位于 `apps/signal-trader`。
- 扩展 command/event，使正式价格证据以显式字段进入 core，而不是隐含依赖 `entry_price`。
- 保留 `entry_price` 的 sizing / 输入用途，但不再作为正式 netting 价格真相。
- 当 quote 缺失、不可解析或不满足最小有效性时，internal netting 不生成 `MidPriceCaptured`，采用 fail-close。

### 非目标

- 不修改 `tools/sql-migration/sql/quote.sql`，不新增 schema。
- 不做多 datasource 仲裁、聚合或质量评分。
- 不把 quote freshness 扩展成全局运行时锁定策略；本轮仅覆盖 internal netting 的正式价格取证。
- 不重构 transfer、capital reconciliation 或其他主链资金逻辑。

## 定义

- 正式价格证据：可写入 domain event、可用于 internal netting 审计的价格真相。
- quote provider：app 层基础设施接口，负责从 SQL `QUOTE` 表读取并规范化正式价格证据。
- fail-close：在缺失正式价格证据时停止 internal netting 结算，不以隐式回退维持“看似成功”的路径。

## quote 表读取策略

### 数据来源

唯一正式来源为 SQL `QUOTE` 表，表结构见 `tools/sql-migration/sql/quote.sql`。读取键为当前 `product_id`；由于表主键包含 `datasource_id`，首版不做隐式 latest-wins 仲裁：

- 若 runtime metadata 显式配置 `signal_trader_quote.datasource_id`，则只读取该 datasource；
- 若未配置且同一 `product_id` 只有一条 quote 行，则直接使用；
- 若未配置且同一 `product_id` 存在多 datasource 行，则 fail-close，返回 `QUOTE_AMBIGUOUS_DATASOURCE`。

### 取值规则

provider 返回规范化后的 `reference_price_evidence`，最小字段建议为：

- `price`: number
- `price_source`: `'sql.quote.bid_ask_mid' | 'sql.quote.last_price'`
- `datasource_id`: string
- `quote_updated_at`: string
- `product_id`: string

价格解析规则：

1. 若 `bid_price` 与 `ask_price` 均可解析为有限数字，使用 `(bid + ask) / 2`。
2. 否则若 `last_price` 可解析为有限数字，使用 `last_price`。
3. 否则视为 quote 不可用。

由于表字段为 `TEXT`，provider 必须在 app 层完成字符串到 number 的解析和有限值校验；core 只消费已规范化结果，不再关心 SQL 字段格式。

### SQL 选择约定

首版 SQL 选择策略冻结为：

- 按 `product_id = ?` 过滤；
- 若配置了 `datasource_id`，则追加 `AND datasource_id = ?`；
- 按 `updated_at DESC` 排序；
- 取 `LIMIT 2`，用于检测“未配置 datasource 时是否存在多来源歧义”。

因此本轮不会偷偷做 datasource 仲裁；没有唯一来源时直接 fail-close。

## app / core 边界设计

### core

`libraries/signal-trader` 继续保持无 SQL 依赖。core 的职责是：

- 在 `SubmitSignalCommand` 中接收可选的正式价格证据字段；
- 在 internal netting 成立时，仅当正式价格证据存在时生成 `MidPriceCaptured`；
- 将价格来源、datasource、quote 时间等证据写入事件；
- 若缺失正式价格证据，则不走 internal netting 结算分支。

### app

`apps/signal-trader` 负责：

- 提供 SQL quote provider；
- 在 `RuntimeWorker.submitSignal()` 中于 `appendCommand()` 前读取 quote；
- 将 provider 结果映射到扩展后的 command 字段；
- 对 quote miss / invalid / ambiguous 做可观测记录（runtime audit log），并让 internal netting fail-close。

边界进一步冻结为：

- service 层不信任外部传入的 `reference_price*`；
- worker 内部会先清洗外部 submit payload，再覆盖正式价格证据；
- `RuntimeManager` 只负责传递依赖，不参与 SQL 细节；
- `RuntimeWorker` 是唯一执行点。

## command / event 扩展

### Command 扩展

在 `SubmitSignalCommand` 上新增正式价格证据字段，建议命名为：

- `reference_price?: number`
- `reference_price_source?: string`
- `reference_price_datasource_id?: string`
- `reference_price_updated_at?: string`

约束：

- `entry_price` 继续保留，服务于 sizing、输入校验、止损风险计算等既有语义。
- `reference_price*` 只表示正式 netting 价格证据，不参与替代 `entry_price` 的风险输入语义。
- 外部 API 即使传入 `reference_price*`，也必须在 worker 内被忽略；只有 quote provider 才能生成并覆盖这些字段。
- 幂等指纹不应把 `reference_price*` 算进去；同一 `signal_id` 的自动重试不因为 quote 时间戳变化而制造 idempotency conflict。

### Event 扩展

扩展 `MidPriceCaptured` payload，建议至少包含：

- `price`
- `source`
- `datasource_id?`
- `quote_updated_at?`

这样 `InternalNettingSettled.mid_price_event_id` 仍复用既有事件关联，不引入新的结算事件类型；同时事件审计时可直接回溯正式价格证据。

## 数据模型 / 接口兼容

### QuoteProvider 接口

建议在 app 层新增最小接口：

```ts
interface QuoteProvider {
  getLatestReferencePrice(input: { product_id: string }): Promise<
    | {
        evidence: {
          product_id: string;
          price: number;
          price_source: string;
          datasource_id: string;
          quote_updated_at: string;
        };
      }
    | {
        reason: 'QUOTE_MISSING' | 'QUOTE_INVALID' | 'QUOTE_AMBIGUOUS_DATASOURCE' | 'QUOTE_QUERY_FAILED';
      }
  >;
}
```

兼容策略：

- provider 只向 app 暴露规范化对象，避免把 SQL row 结构渗透到 runtime/core。
- command / event 新字段均设计为可选，保证旧事件回放与旧测试夹具不必一次性全量改造。
- reducer 对历史 `MidPriceCaptured` 事件保持兼容：旧事件只有 `price` 与 `source` 也应继续可回放。

## 错误语义与 quote 缺失策略

### quote 缺失

当 provider 返回 `undefined` 或 `reason` 时：

- submit 流程不伪造 `reference_price`；
- 若命令路径进入 internal netting 判定，core 不生成 `MidPriceCaptured` / `InternalNettingSettled`；
- 不再回退到 `entry_price`；
- app 必须追加 runtime audit log，至少包含 `runtime_id`、`signal_id`、`product_id` 与 `reason`；
- 该行为定义为 fail-close，而非自动降级成功。

### quote 非法

以下情况视同 quote 不可用：

- SQL 查询无结果；
- `bid_price` / `ask_price` / `last_price` 不能解析为有限数字；
- 解析结果为 `NaN`、`Infinity`、非正数（若现有价格语义要求正数）。

### 可恢复性 / 重试

- quote miss 通常是可恢复错误：下一个 submit 或下一次行情入库后可恢复。
- provider 自身若遇到短暂 SQL 错误，可在 app 层按现有请求失败语义向上抛错；是否锁 runtime 应保持当前 submit error 策略，不在 core 内吞掉。
- internal netting 因 quote 缺失未结算，不应补写伪事件；恢复后由后续正常 submit 重新触发。

## 安全性考虑

- 输入校验：provider 必须对 SQL 文本字段做 number 解析与有限值校验，防止脏数据进入事件真相。
- 权限边界：SQL 访问仅在 app 基础设施层，core 不具备直接读表能力，减少共享库权限膨胀。
- 滥用防护：按单个 `product_id` 精准查询，避免无界扫描 `QUOTE` 表。
- 资源耗尽：不引入常驻轮询型 quote 缓存器，首版按 submit 时按需读取，避免无必要后台负载。
- 审计可追溯：事件写入 `source`、`datasource_id`、`quote_updated_at`，便于定位异常 quote 来源。

## 替代方案

### 方案 A：继续用 `entry_price` 作为 netting 正式价格

放弃原因：实现最省事，但正式价格真相仍来自 submit payload，无法满足本任务的审计与边界要求。

### 方案 B：让 core 直接查询 SQL `QUOTE`

放弃原因：会把基础设施依赖硬塞进 `libraries/signal-trader`，破坏共享库纯度，也让测试边界和复用边界变脏。

### 方案 C：先做多 datasource 仲裁器，再接入 signal-trader

放弃原因：方向上更完整，但明显超出本轮 scope，会把中等风险任务升级成行情架构重做。

## 向后兼容、发布与回滚

### 向后兼容

- 历史事件无需迁移；旧 `MidPriceCaptured` 仍按旧 payload 回放。
- 旧 submit 调用方即使只传 `entry_price` 也不会报协议错误，但 internal netting 不再把它视为正式价格证据。
- sizing / budget / stop-loss 相关逻辑继续使用 `entry_price`，避免本轮连带改动过大。

### 发布

- 先在 app 层接入 provider 与测试；
- 再扩展 command / event；
- 最后切换 internal netting 判定，从 `entry_price` 改为 `reference_price`。

### 回滚

若上线后发现 quote 读取错误率高、误伤 internal netting，可按最小回滚面执行：

- 回滚 app 层 quote provider 注入；
- 回滚 core 对 `reference_price` 的依赖判定；
- 保留新增可选字段定义不删除，以减少二次变更成本。

不建议以“临时偷偷回退到 `entry_price`”作为运行时热修，因为这会直接破坏本 RFC 的正式价格源约束。

## 测试计划

关键行为与验收映射如下：

- quote 命中且存在 internal netting 条件时：生成 `MidPriceCaptured` 与 `InternalNettingSettled`，且 `MidPriceCaptured.source` 指向 SQL quote 来源。
- quote 缺失时：即使 `entry_price` 存在，也不生成 `MidPriceCaptured`。
- quote 仅有 `last_price` 时：provider 正确回退到 `last_price`。
- quote 行字段非法时：provider 返回 `undefined` 或抛出明确错误，不产生伪价格。
- 历史事件回放：旧 `MidPriceCaptured` payload 仍可被 reducer 正常消费。

建议测试落点：

- `libraries/signal-trader/src/index.test.ts`：补 core command/event 行为测试。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：补 app 注入与 SQL provider 集成测试。
- 如 provider 抽成独立文件，再为其补单元测试，覆盖 bid/ask、last_price、invalid row 三类映射。

## 风险与缓解

- 风险 1：`QUOTE` 表数据偶发缺失或 datasource 歧义，导致 internal netting 比以前更保守。缓解：fail-close 是设计目标，同时补充 audit/测试，先确保行为可解释。
- 风险 2：字符串价格解析不一致。缓解：统一在 provider 内集中解析，禁止在多处重复写转换逻辑。
- 风险 3：事件 schema 扩展影响现有测试夹具。缓解：新增字段全部保持 optional，先兼容旧 fixture。
- 风险 4：app 注入链路过深。缓解：沿用现有 execution adapter 风格，在 app 创建入口显式传依赖。

## 里程碑

1. 设计落盘：完成 task-local RFC，冻结字段、边界与 fail-close 语义。
2. app provider：实现 SQL `QUOTE` 读取与规范化映射，并接入 runtime submit path。
3. core 扩展：补 `SubmitSignalCommand` / `MidPriceCaptured` 字段，切换 internal netting 正式价格判定。
4. 验证交付：补 core/app 测试，完成 walkthrough 与风险复核。

## 开放问题

- quote freshness 是否需要最小阈值？本 RFC 明确不引入 freshness gate，也不改变 runtime lock 语义，仅要求读取到可解析的最新行。

## Plan

### 文件变更点

- `apps/signal-trader/src/app.ts`：增加 quote provider 注入入口。
- `apps/signal-trader/src/runtime/runtime-manager.ts` / `apps/signal-trader/src/runtime/runtime-worker.ts`：在 submit path 读取 quote 并映射为 command 字段。
- `apps/signal-trader/src/storage/repositories.ts` 或新增 app 基础设施文件：实现 SQL `QUOTE` provider。
- `apps/signal-trader/src/types.ts`：补 provider 相关类型。
- `libraries/signal-trader/src/types/commands.ts`：补 `reference_price*` 字段。
- `libraries/signal-trader/src/types/events.ts`：扩展 `MidPriceCaptured` 证据字段。
- `libraries/signal-trader/src/engine/dispatch-command.ts`：用 `reference_price` 替代 `entry_price` 作为 internal netting 正式价格依据。
- `libraries/signal-trader/src/index.test.ts`、`apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：补充测试。

### 验证步骤

1. 运行 `signal-trader` core 单测，确认 internal netting 在 quote hit/miss 下行为符合预期。
2. 运行 app 侧测试，确认 provider SQL 读取、映射与 submit 注入链路正确。
3. 验证旧事件回放路径不因新增可选字段失败。
4. 人工审查事件流，确认 `MidPriceCaptured` 不再写入 `submit_signal.entry_price` 作为正式来源。
