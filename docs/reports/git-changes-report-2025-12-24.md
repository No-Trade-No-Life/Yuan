# Git 变更报告（2728fa254..fd343ff16）

## 1. 概览

- **时间范围**：2025-12-23 至 2025-12-23
- **提交数量**：10 个提交
- **主要贡献者**：CZ (5), humblelittlec1[bot] (3), Siyuan Wang (2)
- **热点目录**：apps (130 files), common (75 files), libraries (73 files)
- **生成时间**：2025-12-24T00:06:18.435Z

## 2. 核心变更

### 2.1 并发控制工具增强：信号量与令牌桶

**相关提交**：`c0004011a`, `a3923a862`, `ae415c435`, `89c0d68b1`, `766a46dcf`, `d15860dbf`, `fd343ff16`
**作者**：CZ

**设计意图**：
为系统提供细粒度的并发控制和限速机制，支持分布式环境下的资源协调。信号量用于控制并发访问数量，令牌桶用于平滑请求速率，tokenPool 提供更复杂的资源池管理。这些工具解决了高频交易场景下的限速问题，避免触发交易所 API 限制，同时支持同步获取、取消操作等高级功能，提升系统的稳定性和响应能力。

**核心代码**：
[semaphore.ts:L63-L117](libraries/utils/src/semaphore.ts#L63-L117)

```typescript
export const semaphore = (semaphoreId: string): ISemaphore => {
  let state = mapSemaphoreIdToState.get(semaphoreId);
  if (!state) {
    state = { available: 0, queue: [] };
    mapSemaphoreIdToState.set(semaphoreId, state);
  }

  const acquire = async (perms: number = 1, signal?: AbortSignal): Promise<void> => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });
    
    // 如果信号已经触发，立即拒绝
    if (signal?.aborted) {
      throw newError('SEMAPHORE_ACQUIRE_ABORTED', { semaphoreId, perms });
    }

    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;
      return;
    }

    // 否则加入等待队列
    return new Promise<void>((resolve, reject) => {
      const waitingRequest: WaitingRequest = { resolve, reject, perms, signal };
      state!.queue.push(waitingRequest);
    });
  };
```

**影响范围**：

- 影响模块：`libraries/utils`, `apps/vendor-binance`, `apps/vendor-aster`, `apps/vendor-bitget`, `apps/vendor-gate`, `apps/vendor-huobi`, `apps/vendor-hyperliquid`, `apps/vendor-okx`
- 需要关注：API 变更（新增 acquireSync 方法），AbortSignal 支持，全局状态共享机制

**提交明细**：

- `c0004011a`: 实现信号量工具基础功能和测试
- `a3923a862`: 添加令牌桶实现和测试
- `ae415c435`: 添加 tokenPool 实现和测试
- `89c0d68b1`: 更新 API 文档和变更日志
- `766a46dcf`: 添加 token pool 实现基础功能和测试
- `d15860dbf`: 更新服务选项以应用正确的速率限制
- `fd343ff16`: 为信号量添加 acquireSync 和取消支持

### 2.2 数据库写入优化与性能改进

**相关提交**：`ecc733b4b`
**作者**：CZ

**设计意图**：
优化提供利率和 OHLC 服务的数据库写入逻辑，合并数据行和系列数据范围的写入操作，减少数据库 I/O 次数，提升数据写入性能。通过批量处理和智能合并策略，降低数据库负载，提高高频数据场景下的处理效率，确保实时数据能够及时持久化。

**核心代码**：
由于 JSON 中未提供具体代码片段，该提交主要修改了数据库写入逻辑

**影响范围**：

- 影响模块：`libraries/exchange` 中的利率和 OHLC 服务
- 需要关注：数据库写入模式变更，可能影响数据一致性检查逻辑

**提交明细**：

- `ecc733b4b`: 优化提供利率和OHLC服务的数据库写入逻辑，合并数据行和系列数据范围的写入

### 2.3 版本管理与文档更新

**相关提交**：`efff0b1e7`, `06ab65a07`
**作者**：humblelittlec1[bot], Siyuan Wang

**设计意图**：
维护项目的版本一致性和文档完整性，确保依赖关系正确，变更记录准确。版本号更新反映功能增强和修复，文档更新确保开发者能够正确使用新增的并发控制工具，CHANGELOG 记录提供清晰的变更历史。

**影响范围**：

- 影响模块：`tools/yuanctl`, `apps/account-composer`, 各 vendor 应用
- 需要关注：版本号变更，依赖更新

**提交明细**：

- `efff0b1e7`: 更新文档和变更日志
- `06ab65a07`: 更新版本号到 0.2.14

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `c0004011a` | CZ | feat: implement semaphore utility with basic functionality and tests (#2388) | 2.1 |
| 2 | `a3923a862` | CZ | feat: add token bucket implementation with basic functionality and tests (#2389) | 2.1 |
| 3 | `ae415c435` | CZ | feat: add token pool implementation with basic functionality and tests (#2392) | 2.1 |
| 4 | `89c0d68b1` | CZ | chore: update api docs and changelog (#2390) | 2.1 |
| 5 | `766a46dcf` | CZ | feat: add token pool implementation with basic functionality and tests (#2392) | 2.1 |
| 6 | `d15860dbf` | CZ | feat: 更新服务选项以应用正确的速率限制 (#2393) | 2.1 |
| 7 | `ecc733b4b` | CZ | feat(exchange): 优化提供利率和OHLC服务的数据库写入逻辑，合并数据行和系列数据范围的写入 (#2394) | 2.2 |
| 8 | `efff0b1e7` | Siyuan Wang | chore: update docs and changelog (#2391) | 2.3 |
| 9 | `06ab65a07` | humblelittlec1[bot] | chore: bump version (#2395) | 2.3 |
| 10 | `fd343ff16` | CZ | feat: add acquireSync and cancel to semaphore (#2396) | 2.1 |

> ✅ 确认：所有 10 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| CZ | 5 | 并发控制工具、数据库优化 | `c0004011a`, `fd343ff16`, `ecc733b4b` |
| humblelittlec1[bot] | 3 | 版本管理、自动化 | `06ab65a07` |
| Siyuan Wang | 2 | 文档维护 | `efff0b1e7` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：信号量接口新增 `acquireSync` 方法和 `signal` 参数支持
- **行为变更**：数据库写入逻辑优化，可能影响数据持久化时序

### 性能影响

- **正向影响**：并发控制工具减少 API 限速触发，数据库写入优化提升 I/O 性能
- **资源使用**：全局状态管理增加内存使用，但提升分布式协调能力

### 测试覆盖

- **新增测试**：信号量、令牌桶、tokenPool 的完整测试套件
- **测试策略**：包含基础功能、FIFO 顺序、共享状态、队列管理、并发场景、错误处理等全面测试

### 风险提示

- **高风险**：API 变更需要调用方适配新的接口签名
- **中风险**：全局状态共享机制在分布式环境下需要额外协调
- **低风险**：版本更新和文档变更属于常规维护