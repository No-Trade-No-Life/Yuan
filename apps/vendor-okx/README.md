# @yuants/vendor-okx

OKX 交易所对接包，提供完整的交易、账户管理和市场数据功能。

## 核心能力

### 账户管理

- **多账户类型支持**：交易账户、资金账户、收益账户、策略账户
- **账户信息实时同步**：余额、持仓、挂单状态
- **账户配置缓存机制**：优化 API 调用频率

### 订单系统

- **完整的订单生命周期管理**：提交、修改、取消
- **挂单查询和状态跟踪**：实时更新订单状态
- **订单类型转换**：OKX API 格式到标准格式的转换

### 市场数据

- **K 线数据（OHLC）**：实时和历史数据获取
- **产品信息查询**：交易对详情、合约规格
- **报价数据**：实时行情、深度数据
- **资金费率**：永续合约资金费率查询
- **利率数据**：借贷利率信息
- **市场深度**：订单簿数据

### 交易功能

- **现货和合约交易**：支持多种交易模式
- **网格策略订单**：自动化交易策略
- **仓位档位查询**：风险管理支持

### WebSocket 实时数据

- **实时 K 线数据推送**：多时间粒度支持
- **市场行情订阅**：实时价格更新

## 架构设计亮点

### 模块化组织

```
src/
├── api/                    # API 接口层
│   ├── public-api.ts      # 公共 API（无需认证）
│   └── private-api.ts     # 私有 API（需要认证）
├── public-data/           # 市场数据模块
│   ├── ohlc.ts           # K线数据
│   ├── product.ts        # 产品信息
│   ├── quote.ts          # 报价数据
│   └── market-order.ts   # 市价单数据
├── accountInfos/         # 账户信息处理
│   ├── trading.ts        # 交易账户信息
│   ├── funding.ts        # 资金账户信息
│   ├── earning.ts        # 收益账户信息
│   ├── loan.ts          # 借贷账户信息
│   └── types.ts         # 类型定义
├── orders/               # 订单操作
│   ├── submitOrder.ts   # 提交订单
│   ├── modifyOrder.ts   # 修改订单
│   └── cancelOrder.ts   # 取消订单
└── *.ts                 # 核心服务模块
```

### 服务化架构

- 基于 `@yuants/protocol` 的 Terminal 系统
- 提供标准化的服务接口
- 并发控制和限流机制
- 自动错误处理和重试

### 数据标准化

- 统一的数据格式转换
- 支持多种时间粒度
- 自动写入 SQL 数据库
- 增量更新优化

## 核心技术特点

### 函数式编程范式

- 使用 RxJS 进行响应式编程
- 纯函数设计，避免副作用
- 不可变数据流处理

### 缓存机制

- 使用 `@yuants/cache` 进行 API 调用缓存
- 自动过期和刷新策略
- 内存和持久化缓存支持

### 错误处理

- 完整的 API 错误处理
- 限流控制和重试机制
- 优雅降级策略

### 性能优化

- 批量数据获取
- 增量更新机制
- 内存缓存优化

## 🎯 核心设计理念：多账户支持

### 突破传统限制

传统的交易所对接包通常存在以下限制：

- 通过环境变量预先配置固定数量的账户
- 使用全局状态管理凭证
- 难以动态添加/删除账户
- 账户数量受环境变量限制

### 动态凭证管理架构

OKX 包采用**显式参数传递**的设计，支持**不限量的账户**：

```typescript
// 统一的凭证接口
export interface ICredential {
  access_key: string;
  secret_key: string;
  passphrase: string;
}

// 所有 API 函数都显式接收 credential 参数
export function getAccountBalance(credential: ICredential, params: {...})
export function postTradeOrder(credential: ICredential, params: {...})
export function getAccountPositions(credential: ICredential, params: {...})
```

### 无限账户扩展能力

```typescript
// 可以动态创建任意数量的账户
const mainAccount: ICredential = {
  access_key: 'main_key',
  secret_key: 'main_secret',
  passphrase: 'main_pass',
};

const subAccount1: ICredential = {
  access_key: 'sub1_key',
  secret_key: 'sub1_secret',
  passphrase: 'sub1_pass',
};

const subAccount2: ICredential = {
  access_key: 'sub2_key',
  secret_key: 'sub2_secret',
  passphrase: 'sub2_pass',
};

// 同时操作多个账户
await getAccountBalance(mainAccount, { ccy: 'USDT' });
await getAccountBalance(subAccount1, { ccy: 'BTC' });
await getAccountBalance(subAccount2, { ccy: 'ETH' });
```

### 实际应用场景

1. **多策略运行**：不同交易策略使用独立的账户
2. **风险隔离**：主账户和子账户完全分离
3. **测试环境**：生产账户和测试账户并存
4. **权限管理**：只读账户、交易账户、管理账户分离
5. **资金分配**：不同资金规模的账户独立管理

### 架构优势

- **🔄 可扩展性**：无需修改代码即可支持新账户
- **🎯 灵活性**：账户数量不受环境变量限制
- **🔒 安全性**：凭证隔离，避免误操作
- **🧩 可维护性**：清晰的账户边界和依赖关系
- **🧪 可测试性**：便于单元测试和模拟

## 依赖库使用规范

### 推荐使用的库

1. **@yuants/utils**

   - 字符串拼接为 ID：使用 `encodePath` 和 `decodePath`
   - 时间格式化：`formatTime`
   - 加密函数：`HmacSHA256`

2. **@yuants/sql**

   - 所有 SQL 操作使用该库
   - 避免手写 SQL 语句

3. **@yuants/cache**
   - 缓存相关操作使用该库
   - 避免重复实现缓存逻辑

### 代码组织原则

1. **新文件优先**：在新文件中编写代码后导出函数
2. **避免复杂文件**：如果文件逻辑过于复杂，提取到新文件
3. **函数式编程**：使用函数式范式，避免类继承
4. **明确命名**：避免使用缩写或不常见的术语

## 服务接口

### 提供的服务

- `SubmitOrder` - 提交订单
- `ModifyOrder` - 修改订单
- `CancelOrder` - 取消订单
- `OKX/PositionTiers` - 仓位档位查询
- `Grid/Algo-Order` - 网格策略订单

### 数据流服务

- K 线数据流：`ohlc` 频道
- 账户信息流：实时账户状态更新
- 订单状态流：挂单状态实时同步

## 限流控制

所有 API 调用都遵循 OKX 官方限流规则：

- 公共 API：IP 级别限流
- 私有 API：UserID 级别限流
- WebSocket：连接级别限流

## 开发建议

### 对于其他 Vendor 的实现参考

1. **采用显式凭证传递**：避免全局状态，支持多账户
2. **模块化组织**：按功能划分目录结构
3. **服务化设计**：基于 Terminal 提供标准化服务
4. **缓存优化**：合理使用缓存减少 API 调用
5. **错误处理**：完整的错误处理和重试机制
6. **类型安全**：完整的 TypeScript 类型定义

### 最佳实践

- 使用函数式编程范式
- 保持代码简洁明了
- 遵循项目的编码规范
- 合理使用注释，避免过度注释
- 复用已有的库和工具

## 总结

OKX 包提供了一个完整、健壮、可扩展的交易所对接解决方案，特别在多账户支持方面具有突破性设计，为其他 vendor 的实现提供了优秀的参考模板。其模块化架构、服务化设计和函数式编程范式都是值得学习和借鉴的最佳实践。
