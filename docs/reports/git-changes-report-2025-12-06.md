# Git 变更报告（c36262cad..c3b9a3726）

## 1. 概览

- **时间范围**：2025-12-05 至 2025-12-06
- **提交数量**：21 个提交
- **主要贡献者**：humblelittlec1[bot] (9 commits), Ryan (8 commits), CZ (4 commits)
- **热点目录**：`apps` (24 文件), `common` (3 文件)
- **生成时间**：2025-12-06T06:36:33.236Z
- **分析深度**：Level 2

## 2. 改动聚焦领域

### 2.1 市场数据与资金费率

- **涉及目录**：`apps/vendor-okx/`, `apps/vendor-aster/`, `apps/vendor-hyperliquid/`
- **关键提交**：
  - `af56c8e8a`：`feat: add interest rate (#2208)`
  - `4ecf8af00`：`feat: add new quote (#2209)`
  - `1e77d860a`：`feat: add hl interest rate (#2211)`
  - `8aa2e3f9d`：`feat: add aster interest rate (#2213)`
- **核心改动**：
  - `apps/vendor-okx/src/public-data/quote.ts:194-214`：添加资金费率 WebSocket 订阅，为永续合约提供多头和空头利率数据
  - `apps/vendor-okx/src/ws.ts:333-354`：新增 `useFundingRate` 函数，支持资金费率 WebSocket 通道订阅
  - `apps/vendor-aster/src/api/public-api.ts:118-143`：新增 `getFApiV1PremiumIndex` API 接口，获取标记价格、指数价格和资金费率
  - `apps/vendor-aster/src/services/markets/quote.ts:175-186`：将资金费率数据转换为报价格式，提供多头和空头利率
  - `apps/vendor-hyperliquid/src/services/markets/quote.ts:40-41`：为 Hyperliquid 添加资金费率支持
- **设计意图**：统一各交易所的资金费率数据收集，为风险管理和资金成本计算提供基础数据。通过 WebSocket 和 REST API 两种方式获取实时资金费率，确保数据的及时性和准确性。

### 2.2 订单相关功能重构

- **涉及目录**：`apps/vendor-okx/src/orders/`, `apps/vendor-okx/src/experimental/`
- **关键提交**：
  - `ac108ab9d`：`refactor: move order-related functions to a dedicated orders directory and update imports (#2204)`
  - `6f0d6e65c`：`feat: add broker tag to order submission parameters (#2201)`
  - `60338d133`：`feat: add broker tag to algo order (#2202)`
- **核心改动**：
  - `apps/vendor-okx/src/experimental/exchange.ts:5-10`：更新导入路径，从 `experimental` 目录改为 `orders` 目录
  - `apps/vendor-okx/src/orders/submitOrder.ts:45-118`：重构订单提交逻辑，使用 `slice(-2)` 获取正确的 `instType` 和 `instId`
  - `apps/vendor-okx/src/orders/submitOrder.ts:118`：将 `BROKER_TAG` 改为 `BROKER_CODE` 环境变量
  - `apps/vendor-okx/src/services.ts:24`：算法订单服务中同样将 `BROKER_TAG` 改为 `BROKER_CODE`
- **设计意图**：将订单相关函数从实验性目录迁移到专门的 `orders` 目录，提高代码组织性。同时添加经纪商标签支持，便于订单追踪和佣金计算。

### 2.3 API 请求优化与缓存

- **涉及目录**：`apps/vendor-aster/src/services/markets/`, `apps/vendor-okx/src/ws.ts`
- **关键提交**：
  - `ec771df32`：`chore: temporarily remove open interest caching and related logic (#2206)`
  - `c79ad8cf3`：`fix: interest rate (#2215)`
  - `9d30c323a`：`fix: interest rate (#2216)`
- **核心改动**：
  - `apps/vendor-aster/src/services/markets/quote.ts:64-128`：暂时注释掉未平仓合约缓存和相关逻辑，避免 API 限速问题
  - `apps/vendor-okx/src/ws.ts:272-332`：实现 WebSocket Observable 全局缓存，通过 `shareReplay` 实现订阅复用
  - `apps/vendor-okx/src/public-data/new-quote.ts:319-350`：将资金费率获取从 WebSocket 改为 REST API，避免连接数过多
- **设计意图**：优化 API 请求策略，避免触发交易所限速机制。通过缓存和请求间隔控制，提高系统稳定性。

### 2.4 配置与环境管理

- **涉及目录**：`apps/vendor-okx/`, `apps/vendor-aster/`, `apps/vendor-hyperliquid/`
- **关键提交**：
  - `624436a6e`：`chore: bump version (#2203)`
  - `d8d60c1f2`：`chore: bump version (#2205)`
  - `82809689b`：`chore: bump version (#2207)`
  - `b7e210168`：`chore: bump version (#2210)`
  - `c840c382e`：`chore: bump version (#2212)`
  - `4f88a860d`：`chore: bump version (#2214)`
  - `250b6c5d7`：`chore: bump version (#2217)`
  - `80a3e6962`：`chore: bump version (#2219)`
  - `c3b9a3726`：`chore: bump version (#2221)`
- **核心改动**：
  - 各 vendor 包的版本号更新和 CHANGELOG 维护
  - 环境变量从 `BROKER_TAG` 改为 `BROKER_CODE`
  - 新增 `OPEN_INTEREST_CYCLE_DELAY` 环境变量控制
- **设计意图**：保持各包版本同步，记录变更历史，便于依赖管理和发布追踪。

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
| ---- | ------ | ------------ | -------- |
| humblelittlec1[bot] | 9 | 版本管理、文档更新 | `624436a6e`, `d8d60c1f2`, `82809689b` |
| Ryan | 8 | 市场数据、资金费率功能 | `af56c8e8a`, `4ecf8af00`, `1e77d860a` |
| CZ | 4 | 订单功能重构、API 优化 | `ac108ab9d`, `6f0d6e65c`, `60338d133` |

## 4. 技术影响与风险

### 兼容性影响

- **环境变量变更**：`BROKER_TAG` 改为 `BROKER_CODE`，使用旧环境变量的部署需要更新
- **目录结构变更**：订单相关函数从 `experimental` 目录迁移到 `orders` 目录，相关导入需要更新
- **资金费率数据源**：OKX 的资金费率获取从 WebSocket 改为 REST API，可能影响数据更新频率

### 配置变更

- **新增环境变量**：
  - `BROKER_CODE`：替换原来的 `BROKER_TAG`
  - `OPEN_INTEREST_CYCLE_DELAY`：控制未平仓合约数据获取间隔（默认 60 秒）
- **依赖更新**：各 vendor 包版本号更新，需要重新安装依赖

### 性能影响

- **WebSocket 连接优化**：通过 Observable 缓存减少重复连接，降低资源消耗
- **API 请求控制**：Aster 暂时移除未平仓合约缓存，避免触发限速
- **资金费率获取**：从实时 WebSocket 改为定时 REST API 请求，减少连接数但可能降低实时性

### 测试覆盖

- **未见测试记录**：本次变更主要集中在功能添加和重构，未见相关测试文件更新
- **建议**：新增的资金费率功能和订单重构应添加单元测试和集成测试

## 5. 单提交摘要（附录）

### ac108ab9d CZ | 2025-12-05T06:28:04+00:00 | 重构

**主题**：`refactor: move order-related functions to a dedicated orders directory and update imports (#2204)`

**变更要点**：

- **文件/目录**：`apps/vendor-okx/src/experimental/` → `apps/vendor-okx/src/orders/` - 将订单相关函数迁移到专门目录
- **接口/协议**：更新所有相关文件的导入路径，使用 `slice(-2)` 正确获取 `instType` 和 `instId`
- **行为/数据流**：订单提交、修改、取消功能保持相同行为，仅代码位置变化
- **观测/指标**：无新增监控

**风险/影响**：

- 需要更新所有引用这些函数的代码
- 大规模重构（删除 215 行，新增 10 行），需仔细测试

**测试**：未见测试记录

### af56c8e8a Ryan | 2025-12-05T14:24:08+00:00 | 功能

**主题**：`feat: add interest rate (#2208)`

**变更要点**：

- **文件/目录**：`apps/vendor-okx/src/public-data/quote.ts` - 添加资金费率 WebSocket 订阅
- **接口/协议**：新增 `useFundingRate` WebSocket 通道，返回资金费率、下次结算时间等数据
- **行为/数据流**：为永续合约提供多头利率（负值）和空头利率（正值）
- **观测/指标**：新增 `interest_rate_long`、`interest_rate_short`、`interest_rate_next_settled_at` 字段

**风险/影响**：

- 新增 WebSocket 连接，可能增加连接数
- 需要交易所支持 `funding-rate` 通道

**测试**：未见测试记录

### 4ecf8af00 Ryan | 2025-12-05T14:33:29+00:00 | 功能

**主题**：`feat: add new quote (#2209)`

**变更要点**：

- **文件/目录**：`apps/vendor-okx/src/public-data/new-quote.ts` - 新增独立的报价模块
- **接口/协议**：复制原有报价逻辑，但使用 `encodePath('OKX', ...)` 格式
- **行为/数据流**：提供与原有报价模块相同的功能，但数据结构略有不同
- **观测/指标**：新增模块需要手动导入到主入口文件

**风险/影响**：

- 创建重复功能模块，可能造成代码冗余
- 需要手动添加到 `index.ts` 才能生效

**测试**：未见测试记录

### ec771df32 CZ | 2025-12-05T09:28:14+00:00 | 优化

**主题**：`chore: temporarily remove open interest caching and related logic (#2206)`

**变更要点**：

- **文件/目录**：`apps/vendor-aster/src/services/markets/quote.ts` - 暂时移除未平仓合约缓存
- **接口/协议**：注释掉 `openInterestCache`、`requestInterval$`、`quoteFromOpenInterest$` 相关代码
- **行为/数据流**：避免触发交易所 API 限速，提高系统稳定性
- **观测/指标**：控制台输出调整，减少日志噪音

**风险/影响**：

- 暂时失去未平仓合约数据
- 需要后续优化 API 请求策略后重新启用

**测试**：未见测试记录

---

**报告生成说明**：本报告基于 `docs/reports/git-changes-2025-12-06.json` 数据生成，遵循 git-changes-reporter skill 规范。所有 commit 引用使用短哈希格式，避免使用 JSON 行号。