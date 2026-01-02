# Git 变更报告（63860d8e5..8c128283e）

## 1. 概览

- **时间范围**：2026-01-01 至 2026-01-02
- **提交数量**：11 个提交
- **主要贡献者**：humblelittlec1[bot] (4), Ryan (4), CZ (3)
- **热点目录**：apps (123 files), libraries (68 files), common (63 files)
- **生成时间**：2026-01-02T00:06:16.435Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 信号量性能优化与接口重构

**相关提交**：`4ad3c9921`, `fb5d9ba73`, `8c128283e`
**作者**：CZ

**设计意图**：
优化信号量（semaphore）和资源池（resource pool）的性能和内存使用。首先通过重用 AbortSignal 监听器减少内存分配，然后重构接口移除 Disposable 返回类型以简化调用方代码，最后使用扁平数组存储内部状态以提升队列操作性能。这些优化旨在减少高频并发场景下的内存分配和垃圾回收压力，提升系统整体吞吐量。

**核心代码**：
[libraries/utils/src/semaphore.ts:L34-L124](libraries/utils/src/semaphore.ts#L34-L124)

```typescript
const mapSignalToRejects = new Map<AbortSignal, Set<(reason?: any) => void>>();

const linkSignalAndReject = (signal: AbortSignal, reject: (reason?: any) => void) => {
  let rejects = mapSignalToRejects.get(signal);
  if (!rejects) {
    rejects = new Set();
    mapSignalToRejects.set(signal, rejects);
    const onAbort = () => {
      const rejects = mapSignalToRejects.get(signal);
      if (rejects) {
        const reason = newError('SEMAPHORE_ACQUIRE_ABORTED', {});
        for (const reject of rejects) {
          reject(reason);
        }
        rejects.clear();
        mapSignalToRejects.delete(signal);
      }
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort);
  }
  rejects.add(reject);
};
```

**影响范围**：

- 影响模块：`@yuants/utils` 库中的所有信号量和资源池使用者
- 需要关注：接口变更（移除 Disposable 返回类型）可能影响现有调用代码
- 性能提升：扁平数组存储减少对象创建，提升队列操作效率

**提交明细**：

- `4ad3c9921`: 优化信号量通过重用 AbortSignal 监听器减少内存分配
- `fb5d9ba73`: 重构资源池和信号量接口，移除 Disposable 返回类型
- `8c128283e`: 使用扁平数组优化信号量内部状态管理

### 2.2 利息结算间隔与资金费率集成

**相关提交**：`4e397a658`, `ae0528a51`
**作者**：Ryan

**设计意图**：
完善期货交易中的资金费率（funding rate）信息集成，为交易策略提供准确的利息结算间隔数据。首先在 IQuote 接口中添加利息结算间隔字段并集成 Binance 资金费率信息，然后修正时间单位从秒到毫秒的转换错误，确保时间计算准确性。这些改进支持更精确的资金成本计算和风险管理。

**核心代码**：
[apps/vendor-binance/src/public-data/quote.ts:L169](apps/vendor-binance/src/public-data/quote.ts#L169)

```typescript
const quoteFromFutureFundingInfo$ = futureFundingInfo$.pipe(
  map((entry) => ({
    interest_rate_settlement_interval: entry.fundingIntervalHours
      ? `${entry.fundingIntervalHours * 60 * 60 * 1000}`
      : '',
  }))
);
```

**影响范围**：

- 影响模块：`vendor-binance` 的期货数据流，`trade-copier` 测试策略
- 需要关注：时间单位修正（秒→毫秒）确保资金成本计算准确
- 数据完整性：为期货交易提供完整的资金费率信息

**提交明细**：

- `4e397a658`: 在 IQuote 接口添加利息结算间隔字段并集成 Binance 资金费率信息
- `ae0528a51`: 修正利息结算间隔时间单位从秒到毫秒，优化生成类型声明

### 2.3 Huobi 超级保证金服务优化

**相关提交**：`b02747ddc`
**作者**：Ryan

**设计意图**：
改进 Huobi 超级保证金（Super Margin）账户信息获取的健壮性，避免在账户 UID 获取失败时抛出异常导致服务中断。通过返回空数组替代抛出错误，提升服务的容错能力，确保在部分账户信息不可用时其他功能仍能正常工作。

**核心代码**：
[apps/vendor-huobi/src/services/accounts/super-margin.ts:L14](apps/vendor-huobi/src/services/accounts/super-margin.ts#L14)

```typescript
export const getSuperMarginAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential
) => {
  const superMarginAccountUid = await getSuperMarginAccountUid(credential);
  if (!superMarginAccountUid) return [];
  // ... 后续逻辑
};
```

**影响范围**：

- 影响模块：`vendor-huobi` 的超级保证金账户服务
- 需要关注：空数组返回可能影响依赖完整账户信息的调用方
- 健壮性提升：避免因单个账户信息获取失败导致整体服务中断

**提交明细**：

- `b02747ddc`: 添加 Huobi vendor 变更日志并更新超级保证金服务

### 2.4 UI 类型声明简化与缓存优化

**相关提交**：`49d6e3d57`
**作者**：Ryan

**设计意图**：
简化生成的 UI 类型声明并优化 Huobi 账户模式查询性能。通过引入缓存机制减少对 Huobi API 的重复调用，提升账户模式查询的响应速度，同时简化类型声明生成逻辑，减少代码复杂度。

**核心代码**：
[apps/vendor-huobi/src/services/exchange.ts:L16-L29](apps/vendor-huobi/src/services/exchange.ts#L16-L29)

```typescript
export const accountModeCache = createCache(
  async (credentialKey: string) => {
    const [access_key, secret_key] = decodePath(credentialKey);
    const credential = { access_key, secret_key };
    const res = await getAccountAssetsMode(credential);
    return res.data.asset_mode;
  },
  {
    expire: 600_000, // 10 minutes
    swrAfter: 60_000, // 1 minute
  }
);
```

**影响范围**：

- 影响模块：`vendor-huobi` 的账户模式查询服务
- 性能提升：缓存减少 API 调用，提升响应速度
- 代码简化：优化类型声明生成逻辑

**提交明细**：

- `49d6e3d57`: 简化生成的 UI 类型声明

### 2.5 版本更新与文档维护

**相关提交**：`90e09b2b9`, `a0278b5f8`, `b87351743`, `131376846`
**作者**：humblelittlec1[bot]

**设计意图**：
维护项目版本号和文档的持续更新。包括每日 Git 变更报告的生成、版本号的定期更新，确保项目文档和变更记录保持最新状态，支持团队协作和版本追踪。自动化报告生成确保变更历史可追溯，版本号更新反映项目进展状态。

**核心代码**：
[docs/reports/git-changes-2026-01-01.json](docs/reports/git-changes-2026-01-01.json)

```json
{
  "range": {
    "old": "50233b88db148104551141b3152427485893cc0a",
    "new": "63860d8e5ccce940d5fadd709d23ae9378d89a20",
    "label": "50233b88d..63860d8e5",
    "startDate": "2025-12-31",
    "endDate": "2025-12-31",
    "commitCount": 2,
    "generatedAt": "2026-01-01T00:06:34.549Z"
  }
}
```

**影响范围**：

- 影响模块：项目版本管理、文档系统、CI/CD 流水线
- 需要关注：版本号变更可能影响依赖解析和部署流程
- 文档完整性：确保变更记录及时更新，支持审计和问题排查

**提交明细**：

- `90e09b2b9`: 添加 2026-01-01 的每日 Git 变更报告（2个提交）
- `a0278b5f8`: 更新版本号
- `b87351743`: 更新版本号
- `131376846`: 更新版本号

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `90e09b2b9` | humblelittlec1[bot] | feat: add daily git change report for 2026-01-01 - 2 commits (#2444) | 2.5 |
| 2 | `49d6e3d57` | Ryan | refactor: simplify generated UI type declarations (#2445) | 2.4 |
| 3 | `b02747ddc` | Ryan | feat: add Huobi vendor change log and update super margin service (#2446) | 2.3 |
| 4 | `a0278b5f8` | humblelittlec1[bot] | chore: bump version (#2447) | 2.5 |
| 5 | `4ad3c9921` | CZ | feat: optimize semaphore by reusing abort signal (#2448) | 2.1 |
| 6 | `4e397a658` | Ryan | feat: Add interest rate settlement interval to IQuote and integrate Binance funding rate info. (#2449) | 2.2 |
| 7 | `b87351743` | humblelittlec1[bot] | chore: bump version (#2450) | 2.5 |
| 8 | `ae0528a51` | Ryan | fix: Correct interest rate settlement interval unit to milliseconds and optimize generated type declarations. (#2451) | 2.2 |
| 9 | `131376846` | humblelittlec1[bot] | chore: bump version (#2452) | 2.5 |
| 10 | `fb5d9ba73` | CZ | feat: refactor resource pool and semaphore interfaces to remove Disposable return type for acquire methods (#2453) | 2.1 |
| 11 | `8c128283e` | CZ | feat: optimize semaphore implementation by using a flat array for internal state management (#2454) | 2.1 |

> ✅ 确认：所有 11 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| humblelittlec1[bot] | 4 | 版本更新与文档维护 | `90e09b2b9`, `a0278b5f8`, `b87351743`, `131376846` |
| Ryan | 4 | 交易所集成与数据模型 | `49d6e3d57`, `b02747ddc`, `4e397a658`, `ae0528a51` |
| CZ | 3 | 工具库性能优化 | `4ad3c9921`, `fb5d9ba73`, `8c128283e` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：`fb5d9ba73` 移除了 `ISemaphore` 和 `IResourcePool` 接口的 `Disposable` 返回类型，调用方需要从 `using` 语法改为手动调用 `release()` 方法
- **时间单位修正**：`ae0528a51` 修正了利息结算间隔从秒到毫秒的转换，确保资金成本计算准确

### 配置变更

- **缓存配置**：`49d6e3d57` 引入了 Huobi 账户模式缓存，配置为 10 分钟过期和 1 分钟软过期时间
- **数据字段**：`4e397a658` 在 IQuote 接口中添加了 `interest_rate_settlement_interval` 字段，需要相关服务适配

### 性能影响

- **信号量优化**：`4ad3c9921` 和 `8c128283e` 显著减少内存分配和提升队列操作性能
- **缓存引入**：`49d6e3d57` 通过缓存减少 Huobi API 调用，提升响应速度

### 测试覆盖

- **测试更新**：`4e397a658` 更新了 trade-copier 测试策略以包含新的利息结算间隔字段
- **错误处理**：`b02747ddc` 改进了超级保证金服务的错误处理逻辑

### 风险等级

- **低风险**：版本更新、文档维护、缓存优化
- **中风险**：接口变更需要调用方适配，时间单位修正需要验证计算逻辑
- **高风险**：无高风险变更

---

**报告生成时间**：2026-01-02  
**验证状态**：待验证