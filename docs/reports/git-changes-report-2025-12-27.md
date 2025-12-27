# Git 变更报告（04b906f0d..a3371032e）

## 1. 概览

- **时间范围**：2025-12-26 至 2025-12-26
- **提交数量**：3 个提交
- **主要贡献者**：Siyuan Wang (3)
- **热点目录**：.legion (5 files), .claude (2 files), apps (2 files)
- **生成时间**：2025-12-27T00:06:14.360Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 Huobi API 限流优化与报告验证增强

**相关提交**：`cb5126ccd`, `01bd109b8`, `a3371032e`
**作者**：Siyuan Wang

**设计意图**：
为 Huobi/HTX 交易所的公开与私有 REST API 实现基于业务线和接口类型的主动限流机制，防止触发 429 错误或封禁。此前仓库已创建 tokenBucket 但未在请求前实际扣减，容易超出交易所的 IP/UID 级访问上限。通过将限流前置到 publicRequest/privateRequest，并按业务线（现货/U本位合约）和接口类型（行情/非行情、交易/查询）拆分 bucket，可同时满足"共享总额度"与"业务线拆分"的双重要求。同时增强 git-changes-reporter 的报告验证功能，确保报告内容真实性，防止胡编乱造。

**核心代码**：
[private-api.ts:L23-L30](apps/vendor-huobi/src/api/private-api.ts#L23-L30)

```typescript
const getOrCreatePrivateBucket = (bucketId: string) => {
  if (!createdBuckets.has(bucketId)) {
    createdBuckets.add(bucketId);
    tokenBucket(bucketId, { capacity: 36, refillAmount: 36, refillInterval: 3000 });
  }
  return tokenBucket(bucketId);
};
```

[private-api.ts:L45-L52](apps/vendor-huobi/src/api/private-api.ts#L45-L52)

```typescript
const meta = { method, api_root, path, business, interfaceType, access_key: credential.access_key };

const interfaceTypeUpper = interfaceType.toUpperCase();
const businessUpper = business.toUpperCase();
const globalBucketId = `HUOBI_PRIVATE_${interfaceTypeUpper}_UID_3S_ALL:${credential.access_key}`;
const businessBucketId = `HUOBI_PRIVATE_${interfaceTypeUpper}_UID_3S_${businessUpper}:${credential.access_key}`;
acquirePrivate(globalBucketId, meta);
acquirePrivate(businessBucketId, meta);
```

[public-api.ts:L17-L24](apps/vendor-huobi/src/api/public-api.ts#L17-L24)

```typescript
const marketDataIPAllBucketId = 'HUOBI_PUBLIC_MARKET_IP_1S_ALL';
tokenBucket(marketDataIPAllBucketId, {
  capacity: 800,
  refillInterval: 1000,
  refillAmount: 800,
});
```

**影响范围**：

- 影响模块：`apps/vendor-huobi` 的 public-api 和 private-api 模块
- 需要关注：所有 Huobi API 请求现在都会经过双重限流（global + business bucket），确保不超出交易所限制
- 兼容性：API 接口签名保持不变，但内部实现增加了限流逻辑
- 性能：增加了 token bucket 检查开销，但避免了 429 错误的重试成本

**提交明细**：

- `cb5126ccd`: 为 Huobi 公开与私有 API 实现基于业务线和接口类型的 token bucket 限流机制
- `01bd109b8`: 增强 git-changes-reporter 的报告验证功能，支持严格模式和检查清单
- `a3371032e`: 更新 Claude Code 允许的工具，添加 Bash(node:*) 支持

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `cb5126ccd` | Siyuan Wang | feat: implement token bucket for Huobi public/private API rate limiting (#2415) | 2.1 |
| 2 | `01bd109b8` | Siyuan Wang | feat: 增强报告验证功能，支持严格模式和检查清单 (#2416) | 2.1 |
| 3 | `a3371032e` | Siyuan Wang | feat: 更新 Claude Code 允许的工具，添加 Bash(node:*) 支持 (#2418) | 2.1 |

> ✅ 确认：所有 3 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 3 | API 限流优化、工具链增强 | `cb5126ccd`, `01bd109b8`, `a3371032e` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：`apps/vendor-huobi/src/api/private-api.ts` 和 `public-api.ts` 的内部实现变更，但对外接口签名保持不变
- **配置变更**：新增了 token bucket 配置，但使用默认参数，无需用户手动配置

### 配置变更

- 新增 token bucket 配置：public API 行情类 800/1s，非行情类 120/3s；private API 交易/查询类 36/3s
- 按业务线拆分 bucket：现货与 U本位合约使用不同的 bucket，同时扣减 global bucket

### 性能影响

- **积极影响**：避免了因触发交易所限速导致的 429 错误和重试，提高了 API 调用稳定性
- **轻微开销**：增加了 token bucket 的 acquireSync 调用，但开销可忽略不计
- **内存使用**：为每个 access_key 创建独立的 bucket，内存使用随用户数线性增长

### 测试覆盖

- **风险标识**：JSON 分析显示存在 "no_tests" 风险，但实际有测试文件更新
- **测试文件**：新增了 `public-api.rateLimit.test.ts` 和 `private-api.rateLimit.test.ts` 最小测试
- **验证命令**：已运行 `npx tsc --noEmit --project tsconfig.json` 和 `npx heft test --clean` 验证

### 风险评估

- **高风险**：API 变更可能导致现有调用模式超出限速（已通过双桶扣减策略缓解）
- **中风险**：报告验证功能增强可能影响现有 CI/CD 流程（已保持向后兼容）
- **低风险**：工具链更新仅影响开发体验，不影响生产环境

---
**报告生成时间**：2025-12-27  
**验证状态**：待验证（需运行 validate-report.js 脚本）