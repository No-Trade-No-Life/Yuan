# Git 变更报告（fd005cee1..3eab2932e）

> **时间范围**：2025-12-12 至 2025-12-13
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：8
- **主要贡献者**：CZ (4 commits), humblelittlec1[bot] (3 commits), Siyuan Wang (1 commit)
- **热点项目**：`apps/virtual-exchange` (21 文件), `libraries/secret` (14 文件), `common` (9 文件)
- **风险指标**：⚠️ 0 个高风险项

## 2. 核心变更

### 2.1 密钥管理功能与基准测试实现

**相关提交**：`e74337870`, `3eab2932e`
**作者**：CZ

**设计意图**：
重构虚拟交易所的凭证管理逻辑，引入 `@yuants/secret` 库的密钥管理功能，将原有的直接 SQL 查询替换为标准化的密钥列表查询接口。通过缓存机制优化凭证解析性能，避免重复解密和数据库查询。同时为行情状态管理器添加完整的性能基准测试套件，评估不同实现方案在大规模数据场景下的性能表现，为后续优化提供数据支持。

**核心代码**：
[credential.ts:L18-L33](apps/virtual-exchange/src/credential.ts#L18-L33)

```typescript
const secretSignToCredentialIdCache = createCache(async (sign: string) => {
  const sql = `SELECT * FROM secret WHERE sign = ${escapeSQL(sign)} LIMIT 1;`;
  const res = await requestSQL<ISecret[]>(terminal, sql);
  if (res.length === 0) throw newError('SECRET_NOT_FOUND', { sign });
  const secret = res[0];
  const decrypted = await readSecret(terminal, secret);
  const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;
  return credential;
});
```

**影响范围**：
- 影响模块：`virtual-exchange` 凭证解析与缓存
- 需要关注：缓存配置可能影响凭证变更的实时性

### 2.2 凭证列表格式优化与结算间隔逻辑修复

**相关提交**：`a2c68d358`
**作者**：CZ

**设计意图**：
修复 `listAllCredentials` 函数的返回格式，将原始的 `Promise.allSettled` 结果转换为结构化的响应对象，包含签名、凭证、凭证ID和错误信息。同时优化持仓结算间隔计算逻辑，优先使用行情数据中的下一个结算时间推算结算间隔，仅在无法获取时回退到利率表的时间间隔，提高结算时间预测的准确性。

**核心代码**：
[credential.ts:L50-L78](apps/virtual-exchange/src/credential.ts#L50-L78)

```typescript
const results = await Promise.allSettled(secrets.map((secret) => getCredentialBySecretId(secret.sign)));
return results.map(
  (
    result,
    index,
  ): {
    sign: string;
    credential: IExchangeCredential | null;
    credentialId: string | null;
    error: any;
  } => {
    if (result.status === 'fulfilled') {
      return {
        sign: secrets[index].sign,
        credential: result.value.credential,
        credentialId: result.value.credentialId,
        error: null,
      };
    } else {
      return {
        sign: secrets[index].sign,
        credential: null,
        credentialId: null,
        error: `${result.reason}`,
      };
    }
  },
);
```

**影响范围**：
- 影响模块：`virtual-exchange` 凭证列表服务和持仓结算逻辑
- 需要关注：返回格式变更可能影响下游消费方

### 2.3 告警接收器设计文档重构

**相关提交**：`53e361eb4`
**作者**：Siyuan Wang

**设计意图**：
全面重构告警接收器的设计文档，从简单的规范说明升级为完整的设计说明文档。详细阐述告警对账流程、数据模型、架构设计和运行原理，添加流程图说明各个流水线的工作机制。强调基于 Prometheus 快照的对账原则，确保告警状态的一致性，避免"只触发不恢复"的问题。

**核心代码**：
[README.md:L1-L50](apps/alert-receiver/README.md#L1-L50)

```markdown
## 目标与原则

**目标**
- 可靠记录 Prometheus firing/resolved 的状态演进。
- 通过数据库驱动的通知系统，向飞书发送告警卡片，并在状态变化时更新。
- receiver 自身不稳定时，仍能在恢复后补齐 missing resolved，避免"只触发不恢复"。

**关键原则**
- **SOT（唯一事实来源）是 Prometheus `/api/v1/alerts` 的 firing 快照**。receiver 不推导额外状态。
- **resolved 的产生来自快照对账**：某个 alert 在 DB 里仍为 firing，但在当前快照中缺席，并在 grace 时间后复核仍缺席，才写 resolved。
- 所有写库均为 **幂等 upsert**（以 `id` 作为冲突键）。
```

**影响范围**：
- 影响模块：`alert-receiver` 文档与设计理解
- 需要关注：设计原则变更可能影响后续开发方向

### 2.4 行情服务状态管理与更新动作

**相关提交**：`fdd39ba65`
**作者**：CZ

**设计意图**：
实现行情服务的状态管理和更新动作，为虚拟交易所添加行情数据处理能力。通过扁平化数组存储设计避免内存碎片化，提供高效的读写接口，支持大规模产品数据的实时更新和查询。引入行情状态管理器接口，为后续性能优化和功能扩展奠定基础。

**核心代码**：
[state.ts:L59-L72](apps/virtual-exchange/src/quote/state.ts#L59-L72)

```typescript
const update = (action: IQuoteUpdateAction) => {
  for (const product_id in action) {
    const fields = action[product_id];
    for (const field_name in fields) {
      const field = field_name as IQuoteKey;
      const [value, updated_at] = fields[field]!;
      const oldTuple = getValueTuple(product_id, field);
      if (oldTuple === undefined || updated_at >= oldTuple[1]) {
        setValueTuple(product_id, field, value, updated_at);
      }
    }
  }
};
```

**影响范围**：
- 影响模块：`virtual-exchange` 行情数据处理
- 需要关注：状态管理器的性能表现需要基准测试验证

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 4 | 密钥管理、凭证格式优化、行情服务实现 | `e74337870`, `a2c68d358`, `fdd39ba65`, `3eab2932e` |
| humblelittlec1[bot] | 3 | 版本更新、文档维护 | `8552e9d99`, `328e8765b`, `037ce992a` |
| Siyuan Wang | 1 | 告警接收器设计文档重构 | `53e361eb4` |

## 4. 风险评估

### 兼容性影响

- **低风险**：所有变更均为功能增强、优化或文档更新，无 API 破坏性变更
- **凭证列表格式**：`listAllCredentials` 返回格式从 `Promise.allSettled` 结果转换为结构化对象，下游消费方需要适配
- **密钥管理接口**：引入 `@yuants/secret` 库的标准化接口，替换原有的直接 SQL 查询

### 配置变更

- **缓存配置**：`secretSignToCredentialIdCache` 和 `credentialIdCache` 新增缓存机制
- **行情服务**：新增 `quote/service` 模块导入到主入口文件
- **基准测试**：新增性能测试配置和命令行参数

### 性能影响

- **缓存优化**：凭证解析增加两级缓存，减少数据库查询和解密操作
- **内存优化**：行情状态管理器使用扁平化数组存储，避免内存碎片
- **算法优化**：结算间隔计算优先使用行情数据，提高预测准确性

### 测试覆盖

- **基准测试**：为行情状态管理器添加完整的性能基准测试套件
- **文档测试**：告警接收器设计文档全面更新，包含详细的设计原则和流程图
- **建议**：为凭证管理功能添加单元测试，验证缓存机制的正确性

---

**生成时间**：2025-12-13  
**数据源**：docs/reports/git-changes-2025-12-13.json  
**分析工具**：git-changes-reporter v3.0.0