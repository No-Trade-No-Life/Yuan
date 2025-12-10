# Git 变更报告（4a65d80af..dcb3ba955）

> **时间范围**：2025-12-09 08:00 至 2025-12-10 08:00（东八区）
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：18
- **主要贡献者**：github-actions[bot] (6 commits), humblelittlec1[bot] (5 commits), CZ (5 commits), Ryan (1 commit), Siyuan Wang (1 commit)
- **热点项目**：`apps/virtual-exchange` (6 文件), `apps/vendor-aster` (5 文件), `apps/vendor-binance` (5 文件), `libraries/data-account` (5 文件)
- **风险指标**：⚠️ 1 个中风险项（功能提交未包含测试更新）

## 2. 核心变更

### 2.1 Virtual Exchange 持仓数据 Polyfill 系统

**相关提交**：`449264c52`, `1afd192d4`, `38ebc125d`
**作者**：CZ

**设计意图**：
将原本分散在 `libraries/exchange` 中的持仓数据增强逻辑（polyfill）迁移到 `virtual-exchange` 服务中集中处理。这样做的好处是：

1. 统一在服务层完成数据补全，减少各 vendor 重复实现
2. 通过缓存机制优化产品和行情查询性能
3. 新增 `settlement_interval`（结算间隔）字段支持，用于展示资金费率结算周期

**核心代码**：
[position.ts:L19-L35](apps/virtual-exchange/src/position.ts#L19-L35)

```typescript
export const polyfillPosition = async (positions: IPosition[]): Promise<IPosition[]> => {
  for (const pos of positions) {
    const [theProduct, quote, interestRateInterval] = await Promise.all([
      productCache.query(pos.product_id),
      quoteCache.query(pos.product_id),
      interestRateIntervalCache.query(pos.product_id),
    ]);

    // 估值 = value_scale * volume * closable_price
    if (theProduct) {
      pos.valuation = Math.abs((theProduct.value_scale || 1) * pos.volume * pos.closable_price);
    }
    // 利率相关信息的追加
    if (quote?.interest_rate_next_settled_at !== null) {
      pos.settlement_scheduled_at = new Date(quote.interest_rate_next_settled_at).getTime();
    }
  }
  return positions;
};
```

**影响范围**：

- 影响模块：`virtual-exchange`, `libraries/exchange`, `libraries/data-account`
- `IPosition` 接口新增 `settlement_interval` 字段
- 原 `libraries/exchange` 中 41 行 polyfill 代码已删除

---

### 2.2 Aster 清算价格 API 集成

**相关提交**：`b0261df93`
**作者**：CZ

**设计意图**：
通过集成 `/fapi/v2/positionRisk` API，为 Aster 持仓信息补充清算价格（`liquidation_price`）字段。此前持仓数据缺少清算价格信息，影响风险监控功能的完整性。

**核心代码**：
[private-api.ts:L186-L207](apps/vendor-aster/src/api/private-api.ts#L186-L207)

```typescript
export const getFApiV2PositionRisk = createFutureApi<
  { symbol?: string },
  {
    entryPrice: string;
    leverage: string;
    liquidationPrice: string; // 清算价格
    markPrice: string;
    positionAmt: string;
    symbol: string;
    unRealizedProfit: string;
    positionSide: string;
  }[]
>('GET', '/fapi/v2/positionRisk');
```

**影响范围**：

- 影响模块：`vendor-aster`
- 持仓查询会额外调用 positionRisk API 获取清算价格

---

### 2.3 Binance 可平仓价格与下单逻辑修复

**相关提交**：`339c0b00e`, `b5e1e0ed2`
**作者**：Ryan, CZ

**设计意图**：
修复两个关键问题：

1. **volume 计算**：持仓数量应取绝对值，避免负数导致计算错误
2. **closable_price 计算**：由于 `positionAmt` 本身带正负号，计算未实现盈亏对应价格时不需要取绝对值（除法时正负会自然抵消）
3. **单向持仓模式**：预留 `isSingleSideMode` 标志，为后续支持单向持仓模式的 `reduceOnly` 下单做准备

**核心代码**：
[unified.ts:L33-L36](apps/vendor-binance/src/services/accounts/unified.ts#L33-L36)

```typescript
volume: Math.abs(+position.positionAmt),
free_volume: Math.abs(+position.positionAmt),
// ISSUE: positionAmt 有正负，这里计算有个 trick，不需要区分仓位方向
closable_price: +position.entryPrice + +position.unrealizedProfit / +position.positionAmt,
```

**影响范围**：

- 影响模块：`vendor-binance`
- 修复持仓显示中 volume 为负数的问题
- 修复可平仓价格计算不正确的问题

---

### 2.4 CI/CD 改进：GitHub App Token 方式创建 PR

**相关提交**：`f3139db51`
**作者**：Siyuan Wang

**设计意图**：
将每日 Git 报告的 PR 创建从使用 `GITHUB_TOKEN` 改为使用 GitHub App Token。GitHub App Token 拥有更灵活的权限控制，且可以触发其他 workflow（普通 GITHUB_TOKEN 创建的 PR 不会触发 CI）。

**核心代码**：
[daily-git-report.yml](.github/workflows/daily-git-report.yml)

```yaml
- uses: actions/create-github-app-token@v1
  id: generate-token
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

**影响范围**：

- 影响模块：`.github/workflows`, `.claude/skills/git-changes-reporter`
- 需要配置 `APP_ID` 和 `APP_PRIVATE_KEY` secrets

---

## 3. 贡献者

| 作者                | 提交数 | 主要工作                                       | 关键提交                 |
| ------------------- | ------ | ---------------------------------------------- | ------------------------ |
| CZ                  | 5      | 持仓 polyfill 系统、清算价格 API、价格计算修复 | `449264c52`, `b0261df93` |
| Ryan                | 1      | volume 绝对值修复                              | `339c0b00e`              |
| Siyuan Wang         | 1      | CI 流程改进                                    | `f3139db51`              |
| humblelittlec1[bot] | 5      | 自动版本发布                                   | -                        |
| github-actions[bot] | 6      | 每日报告生成                                   | -                        |

## 4. 风险评估

### 接口变更

- `IPosition` 接口新增 `settlement_interval?: number` 字段（非破坏性变更）
- `@yuants/exchange` 移除了 41 行 polyfill 代码，相关逻辑迁移到 `virtual-exchange`

### 依赖变更

- `vendor-okx` 移除了未使用的 `@yuants/secret` 依赖
- `virtual-exchange` 新增 `@yuants/data-quote` 依赖

### 测试覆盖

- ⚠️ 功能提交未包含测试文件更新，建议补充单元测试

### 配置变更

- CI 需要新增 `APP_ID` 和 `APP_PRIVATE_KEY` secrets
