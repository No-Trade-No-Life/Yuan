# Git 变更报告（a8a9f78b5..935f0cc6f）

## 1. 概览

- 时间范围：2025-12-02 至 2025-12-02
- 提交数量：4
- 主要贡献者：humblelittlec1[bot] (2), CZ (2)
- 热点目录：apps (30 文件), common (10 文件), libraries (5 文件)

## 2. 改动聚焦领域

### 2.1 错误处理与观测

- **涉及目录**：apps/vendor-turboflow
- **关键提交**：`2be2c216c` (fix: enhance privateRequest logging and handle undefined params in listOrders (#2152))
- **核心改动**：
  - `apps/vendor-turboflow/src/api/private-api.ts`：增强日志记录，添加时间戳和结构化输出；修复 URL 参数处理，跳过 undefined 值
  - `apps/vendor-turboflow/src/services/orders/listOrders.ts`：添加空值保护，处理 `response.data.data` 可能为 undefined 的情况
  - `apps/vendor-turboflow/src/services/orders/submitOrder.ts`：添加订单量验证（volume < 1 时抛出错误）；改进杠杆计算和保证金逻辑
- **设计意图**：提升系统可观测性，增强错误处理鲁棒性，确保 API 调用的稳定性和调试便利性

### 2.2 功能开发

- **涉及目录**：libraries/exchange
- **关键提交**：`bb6539d08` (feat: add type parameter to listProducts service and update API definition (#2154))
- **核心改动**：
  - `libraries/exchange/src/index.ts`：为 `listProducts` 服务添加 type 参数，增强服务接口验证
  - `libraries/exchange/etc/exchange.api.md`：更新 API 文档，反映接口变更
- **设计意图**：扩展 exchange 库功能，为产品列表查询添加类型过滤支持，提升接口灵活性和类型安全性

### 2.3 依赖更新

- **涉及目录**：apps/vendor-*, libraries/exchange
- **关键提交**：`935f0cc6f` (chore: bump version (#2155))
- **核心改动**：
  - 多个 vendor 包版本更新：vendor-aster (0.7.11 → 0.7.12), vendor-binance (0.10.3 → 0.10.4), vendor-bitget (0.10.0 → 0.10.1), vendor-gate (0.4.11 → 0.4.12), vendor-huobi (0.15.3 → 0.15.4), vendor-hyperliquid (0.7.2 → 0.7.3), vendor-okx (0.27.10 → 0.27.11), vendor-turboflow (1.2.4 → 1.2.5), virtual-exchange (0.4.1 → 0.4.2)
  - `libraries/exchange` 版本从 0.1.2 升级到 0.2.0，包含新功能
- **设计意图**：同步依赖版本，确保各 vendor 包使用最新的 exchange 库功能

### 2.4 运维与部署

- **涉及目录**：apps/vendor-turboflow
- **关键提交**：`3409dd4e3` (chore: bump version (#2153))
- **核心改动**：
  - `apps/vendor-turboflow/CHANGELOG.json` 和 `CHANGELOG.md`：更新变更日志
  - `apps/vendor-turboflow/package.json`：版本从 1.2.3 升级到 1.2.4
- **设计意图**：维护版本管理和发布流程，确保变更记录完整

## 3. 贡献者分析

| 作者 | 提交数 | 主要领域 |
|------|--------|----------|
| humblelittlec1[bot] | 2 | 运维与部署、依赖更新 |
| CZ | 2 | 错误处理与观测、功能开发 |

## 4. 技术影响与风险

- **兼容性影响**：`libraries/exchange` 从 0.1.2 升级到 0.2.0 包含 breaking change（添加 type 参数），所有依赖的 vendor 包需要同步更新
- **配置变更**：无重大配置变更
- **性能影响**：日志增强可能增加少量性能开销，但提升可观测性价值显著
- **测试覆盖**：未见测试文件变更，建议为新增的 type 参数验证逻辑添加测试

## 5. 单提交摘要（附录）

### 2be2c216c CZ | 2025-12-02 14:23:23 +0800 | fix

**主题**：fix: enhance privateRequest logging and handle undefined params in listOrders (#2152)

**变更要点**：

- `apps/vendor-turboflow/src/api/private-api.ts:30-33`：修复 URL 参数处理，跳过 undefined 值
- `apps/vendor-turboflow/src/api/private-api.ts:69-75`：增强日志格式，添加时间戳和结构化输出
- `apps/vendor-turboflow/src/services/orders/listOrders.ts:66`：添加空值保护，处理可能为 undefined 的响应数据
- `apps/vendor-turboflow/src/services/orders/submitOrder.ts:41-44`：添加订单量验证（volume < 1 时抛出 TURBOFLOW_MIN_ORDER_VOLUME 错误）
- `apps/vendor-turboflow/src/services/orders/submitOrder.ts:47-50`：改进杠杆计算和保证金逻辑，区分开仓和平台操作

**风险/影响**：

- 日志格式变更可能影响现有日志解析工具
- 新增的订单量验证可能拒绝之前接受的微小订单

**测试**：未见测试记录

### 3409dd4e3 humblelittlec1[bot] | 2025-12-02 14:34:24 +0800 | chore

**主题**：chore: bump version (#2153)

**变更要点**：

- `apps/vendor-turboflow/CHANGELOG.json` 和 `CHANGELOG.md`：更新变更日志记录 1.2.4 版本
- `apps/vendor-turboflow/package.json`：版本从 1.2.3 升级到 1.2.4

**风险/影响**：标准版本更新流程，无功能风险

**测试**：未见测试记录

### bb6539d08 CZ | 2025-12-02 21:32:25 +0800 | feat

**主题**：feat: add type parameter to listProducts service and update API definition (#2154)

**变更要点**：

- `libraries/exchange/src/index.ts:126-140`：为 `ListProducts` 服务添加 type 参数验证
- `libraries/exchange/src/index.ts:261-262`：更新 `listProducts` 函数签名，添加 type 参数
- `libraries/exchange/etc/exchange.api.md:56`：更新 API 文档反映接口变更

**风险/影响**：

- Breaking change：所有调用 `listProducts` 的客户端需要更新，添加 type 参数
- 新增的 schema 验证确保 type 参数必须与 exchange.name 匹配

**测试**：未见测试记录

### 935f0cc6f humblelittlec1[bot] | 2025-12-02 22:22:51 +0800 | chore

**主题**：chore: bump version (#2155)

**变更要点**：

- 更新 9 个 vendor 包版本，同步依赖 `@yuants/exchange` 到 0.2.0
- `libraries/exchange` 从 0.1.2 升级到 0.2.0，包含新功能
- 所有 vendor 包的 CHANGELOG 和 package.json 相应更新

**风险/影响**：

- 大规模依赖更新需要确保所有 vendor 包与 exchange 0.2.0 兼容
- 建议进行集成测试验证各 vendor 功能正常

**测试**：未见测试记录