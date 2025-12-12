# Git 变更报告（a23c52dc5..fd005cee1）

> **时间范围**：2025-12-11 至 2025-12-12
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：5
- **主要贡献者**：CZ (2 commits), humblelittlec1[bot] (2 commits), Siyuan Wang (1 commit)
- **热点项目**：`apps/virtual-exchange` (6 文件), `apps/alert-receiver` (4 文件), `apps/vendor-okx` (4 文件)
- **风险指标**：⚠️ 1 个中等风险项（无测试覆盖）

## 2. 核心变更

### 2.1 利息结算优化与账户信息增强

**相关提交**：`e32477731`, `ddf33c43e`
**作者**：CZ

**设计意图**：
优化虚拟交易所的利息结算逻辑，从固定时间预测改为基于历史利率数据的动态计算。原实现假设结算时间固定间隔，但实际利率数据可能有不规则间隔。新算法通过分析最近两次利率更新时间计算实际间隔，并动态预测下一个结算时间，提高结算时间预测的准确性。同时为账户信息面板添加利息周期显示，增强用户体验。

**核心代码**：
[position.ts:L21-L40](apps/virtual-exchange/src/position.ts#L21-L40)

```typescript
const interestRateIntervalCache = createCache(
  async (product_id: string) => {
    const sql = `select created_at from interest_rate where series_id = ${escapeSQL(
      product_id,
    )} order by created_at desc limit 2`;
    const rates = await requestSQL<{ created_at: string }[]>(terminal, sql);
    if (rates.length < 2) return undefined;
    const prev = new Date(rates[0].created_at).getTime();
    const prevOfPrev = new Date(rates[1].created_at).getTime();
    const interval = prev - prevOfPrev;
    return {
      prev,
      prevOfPrev,
      interval,
    };
  },
  { swrAfter: 3600_000, expire: 8 * 3600_000 },
);
```

**影响范围**：
- 影响模块：`virtual-exchange` 利息结算预测
- 需要关注：缓存配置（SWR 1小时，过期8小时）可能影响实时性

### 2.2 动态结算时间计算算法

**相关提交**：`e32477731`
**作者**：CZ

**设计意图**：
实现精确的利息结算时间预测算法。通过公式 `prev + k * interval > now` 找到最小整数 k，确保预测的结算时间总是未来时间。相比之前简单的 `prev + interval` 方式，新算法能正确处理跨越多个结算周期的情况，避免预测时间落在过去。

**核心代码**：
[position.ts:L74-L77](apps/virtual-exchange/src/position.ts#L74-L77)

```typescript
// 找到 prev + k * interval > now 的最小 k，则下一个结算时间为 prev + k * interval
const k = Math.ceil((Date.now() - interestRateInterval.prev) / interestRateInterval.interval);
pos.settlement_scheduled_at = interestRateInterval.prev + k * interestRateInterval.interval;
```

**影响范围**：
- 影响模块：所有使用虚拟交易所利息结算预测的功能
- 需要关注：当 `interval` 为0或负数时的边界情况处理

### 2.3 持仓数据增强 - 添加账户ID

**相关提交**：`ddf33c43e`
**作者**：CZ

**设计意图**：
在 GetPositions 和 GetOrders 服务的补全逻辑中为持仓数据添加 `account_id` 字段。确保从虚拟交易所获取的持仓数据包含完整的账户标识信息，便于下游系统进行账户级别的数据聚合和分析。

**核心代码**：
[general.ts:L25-L27](apps/virtual-exchange/src/general.ts#L25-L27)

```typescript
positions.forEach((pos) => {
  pos.account_id = credential.credentialId;
});
```

**影响范围**：
- 影响模块：`virtual-exchange` 的 GetPositions 和 GetOrders 服务
- 需要关注：确保所有虚拟交易所的持仓数据都包含账户ID

### 2.4 警报严重度计算重构

**相关提交**：`fd005cee1`
**作者**：Siyuan Wang

**设计意图**：
重构警报接收器的严重度计算逻辑，增强警报消息渲染。通过优化严重度评估算法，提高警报分类的准确性，同时改进消息展示格式，使操作人员能更快速理解警报内容和紧急程度。

**影响范围**：
- 影响模块：`alert-receiver` 警报处理流水线
- 需要关注：严重度计算逻辑变更可能影响现有警报分类

### 2.5 OKX 凭证错误信息优化

**相关提交**：`e32477731`
**作者**：CZ

**设计意图**：
优化 OKX 交易所凭证验证的错误信息，在凭证无效时提供更详细的上下文信息。将简单的凭证对象替换为完整的 API 响应对象，便于调试和问题诊断。

**核心代码**：
[exchange.ts:L26-L29](apps/vendor-okx/src/experimental/exchange.ts#L26-L29)

```typescript
const res = await getAccountConfig(credential);
const uid = res.data?.[0]?.uid;
if (!uid) throw newError('OKX_CREDENTIAL_INVALID', { res });
```

**影响范围**：
- 影响模块：`vendor-okx` 凭证验证
- 需要关注：错误对象结构变更，下游错误处理可能需要适配

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 2 | 利息结算优化、持仓数据增强 | `e32477731`, `ddf33c43e` |
| humblelittlec1[bot] | 2 | 版本更新、文档维护 | `328c98b84`, `f4851cd2c` |
| Siyuan Wang | 1 | 警报系统重构 | `fd005cee1` |

## 4. 风险评估

### 兼容性影响

- **低风险**：所有变更均为功能增强或优化，无 API 破坏性变更
- **OKX 错误对象**：`OKX_CREDENTIAL_INVALID` 错误现在包含完整响应对象而非原始凭证，可能影响现有错误处理逻辑

### 配置变更

- **缓存配置**：`interestRateIntervalCache` 新增缓存配置参数 `{ swrAfter: 3600_000, expire: 8 * 3600_000 }`
- **UI 配置**：账户信息面板新增 `settlement_interval` 列显示

### 性能影响

- **缓存优化**：利息间隔缓存增加 SWR 和过期时间配置，减少数据库查询频率
- **算法优化**：动态结算时间计算避免不必要的重复计算

### 测试覆盖

- **中等风险**：所有功能提交均未见测试文件更新
- **建议**：为利息结算算法和账户ID添加添加单元测试

---

**生成时间**：2025-12-12  
**数据源**：docs/reports/git-changes-2025-12-12.json  
**分析工具**：git-changes-reporter v3.0.0