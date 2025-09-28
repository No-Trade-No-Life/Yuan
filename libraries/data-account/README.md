# @yuants/data-account

`@yuants/data-account` 提供账户资金与持仓的统一建模、服务化推送和持久化辅助工具，帮助终端在 Yuan 体系内快速同步账户视图、写入数据库并输出监控指标。

- **服务即数据流**：`provideAccountInfoService` 将账户查询、频道广播与自动刷新封装在一起，实现“一次接入，多端订阅”。
- **数据落地友好**：内置 `addAccountMarket`、`requestSQL` 相关封装，推送过程中即可结构化写入 `account_balance` 与 `position` 表。
- **运维可观测**：集成 OpenTelemetry 指标，基础资金、持仓维度均默认打点，便于在 Prometheus 中回溯账户健康状况。

## 快速上手

`provideAccountInfoService` 负责把账户快照包装成服务+频道，`useAccountInfo` 则用于在终端侧订阅该频道，两者配合即可完成“写一次、看多处”的账户同步。

```ts
import { Terminal } from '@yuants/protocol';
import { provideAccountInfoService, useAccountInfo } from '@yuants/data-account';

const terminal = Terminal.fromNodeEnv(); // 需预先配置 HOST_URL、TERMINAL_ID 等环境变量

provideAccountInfoService(
  terminal,
  'ACC-001',
  async () => ({
    money: {
      currency: 'USDT',
      equity: 10_000,
      free: 10_000,
    },
    positions: [],
  }),
  { auto_refresh_interval: 1_000 }, // 默认可设置为 1 秒，确保断流后快速补齐
);

useAccountInfo(terminal, 'ACC-001').subscribe((info) => {
  console.log(`权益: ${info.money.equity}, 持仓数: ${info.positions.length}`);
});
```

## 功能模块

### 服务与频道

- `provideAccountInfoService(terminal, account_id, query, options?)`：注册查询服务并推送账户信息，可选超时触发自动刷新；内部会自动写入 SQL 与指标。
- `publishAccountInfo(terminal, account_id, accountInfo$)`：将账户信息流发布为 `AccountInfo` 频道并同时写入 SQL 与指标。
- `useAccountInfo(terminal, account_id)`：订阅指定账户的实时信息流，支持断线自动重连。

### 数据处理工具

- `createEmptyAccountInfo(account_id, currency, leverage?, initial_balance?)`：迅速构造空账户结构，便于初始化状态或单元测试。
- `mergeAccountInfoPositions(info)`：将同品种同方向的持仓聚合，输出合并后的 `IAccountInfo`。
- `diffPosition(source, target)`：比较两份头寸列表，返回差异量 `IPositionDiff`，用于风控核对或调仓校验。

### 数据库辅助

- `addAccountMarket(terminal, { account_id, market_id })`：在 `account_market` 表插入账户与行情源的关联记录，避免重复写入。

### 类型定义

- `IAccountInfo`：账户整体视图（资金、持仓、更新时间）。
- `IAccountMoney`：账户资金结构（权益、余额、杠杆、保证金等字段）。
- `IPosition`：原子持仓明细，支持方向、可用量、估值等扩展属性。
- `IPositionDiff`：用于描述两套持仓之间的差异。

## 实践提示

- 使用前请通过环境变量配置 `HOST_URL`、`TERMINAL_ID` 等参数，并调用 `Terminal.fromNodeEnv()` 创建终端实例。
- 建议在 `query` 函数中直接复用交易所或缓存层的快照，保持返回结构与 `IAccountInfo` 一致，避免二次映射成本。
- 建议从 `auto_refresh_interval = 1_000` 起步，根据链路健康度再行调整。
- 指标默认落在 `account` Meter 下，可结合自定义标签或 PromQL 预警账户资金异常、单品持仓失衡等场景。
