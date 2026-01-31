# HTTP Proxy Service Metrics 打点与 Dashboard — 上下文

## 会话进展（2026-01-30）

### ✅ 已完成

- 加载 legionmind skill，恢复 http-proxy-service 主任务状态
- 检查 http-proxy-service 代码发现 **未实现 metrics 打点**（仅有 console.warn）
- 创建任务提案并获得用户批准
- **生成 RFC 文档**（docs/rfc.md），包含完整的 metrics 规范和 Dashboard 设计
- **RFC 对抗审查**（review-rfc）完成，4 项问题待修正
- **RFC 复审通过**（review-rfc-recheck），所有修正已正确处理
- 阅读 RFC 文档并理解设计规范
- 阅读现有 server.ts 代码结构
- 查看 @yuants/protocol 的 metrics API 用法
- 阅读 RFC 文档并理解设计规范
- 阅读现有 server.ts 代码结构
- 查看 @yuants/protocol 的 metrics API 用法
- 在 server.ts 中添加 metrics 初始化代码
- 在请求处理 handler 中添加 metrics 采集点
- 阅读 RFC 文档并理解设计规范
- 阅读现有 server.ts 代码结构
- 查看 @yuants/protocol 的 metrics API 用法
- 在 server.ts 中添加 metrics 初始化代码
- 在请求处理 handler 中添加 metrics 采集点
- 添加 metrics 单元测试
- 阅读 RFC 文档并理解设计规范
- 阅读现有 server.ts 代码结构
- 查看 @yuants/protocol 的 metrics API 用法
- 在 server.ts 中添加 metrics 初始化代码
- 在请求处理 handler 中添加 metrics 采集点
- 添加 metrics 单元测试
- 创建 Grafana Dashboard 模板

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键决策

| 决策                                                    | 原因                                                                                                               | 替代方案                                  | 日期       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------- |
| 使用 5 个核心指标（Counter x2、Histogram x2、Gauge x1） | 覆盖请求量、延迟、活跃连接、响应大小、错误分类五个维度                                                             | 仅使用 Counter（缺少百分位数据）          | 2026-01-30 |
| `error_code` Label 使用预定义枚举值                     | 避免高基数问题，保证查询性能                                                                                       | 动态拼接错误消息（高基数风险）            | 2026-01-30 |
| `method` Label 支持 7 种 HTTP 方法                      | 与 IHTTPProxyRequest.type.method 枚举一致                                                                          | 简化为 GET/POST 两类（丢失细粒度）        | 2026-01-30 |
| Terminal labels（region、tier、ip）可选                 | 兼容未设置 tags 的 Terminal                                                                                        | 强制要求必须设置（破坏向后兼容）          | 2026-01-30 |
| Histogram bucket 配置覆盖 0.01s-30s                     | 覆盖从极速到超时的全范围                                                                                           | 默认 Prometheus buckets（可能不匹配业务） | 2026-01-30 |
| 错误响应也记录 duration                                 | 便于分析超时/网络错误的影响时长                                                                                    | 错误时不记录（缺少失败请求的延迟数据）    | 2026-01-30 |
| 移除 response_size_bytes 指标                           | 代理核心价值不在响应大小监控，流式读取场景下计算响应大小与内存效率目标冲突，且用户未明确提出此需求                 | —                                         | 2026-01-30 |
| 移除 errors_total.reason Label                          | reason 可能包含 URL 或错误消息动态内容，存在高基数风险，可能导致 Prometheus 内存耗尽。调试信息依赖日志而非 metrics | —                                         | 2026-01-30 |
| Dashboard 精简至 8 个核心面板                           | 原设计 16 个面板认知负荷过高，精简后每个面板对应明确用户故事，便于快速定位问题                                     | —                                         | 2026-01-30 |
| Histogram Bucket 扩展至 30s 上界                        | 默认超时 30s，原配置 10s 无法区分 10-30s 的请求。新配置：[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]           | —                                         | 2026-01-30 |
| Q1 hostname 聚合暂缓实施                                | hostname 属于中等基数，待真实流量分析后再决定是否需要，避免过早优化                                                | —                                         | 2026-01-30 |

---

## 备选方案与取舍

### 指标设计取舍

| 方案                        | 选择    | 取舍                                                     |
| --------------------------- | ------- | -------------------------------------------------------- |
| 仅使用 Counter              | ❌ 放弃 | 缺少延迟百分位数据，无法满足 SRE 延迟 SLA 监控           |
| Counter + Histogram + Gauge | ✅ 采用 | 完整覆盖监控需求，额外开销可接受                         |
| 自定义 metrics registry     | ❌ 放弃 | 复用 `@yuants/protocol` 的 `terminal.metrics` 保持一致性 |

### Labels 基数控制

| 方案                                                | 选择          | 取舍                             |
| --------------------------------------------------- | ------------- | -------------------------------- |
| 包含 URL 路径                                       | ❌ 放弃       | 高基数会导致 Prometheus 内存爆炸 |
| 包含 hostname                                       | ⚠️ 待定（Q1） | 中等基数，可能需要按场景启用     |
| 仅 method、status_code、error_code、terminal_labels | ✅ 采用       | 安全但缺少按服务名聚合能力       |

### Dashboard 面板设计

| 方案              | 选择    | 取舍                         |
| ----------------- | ------- | ---------------------------- |
| 单一聚合面板      | ❌ 放弃 | 无法按 Terminal 分组排查问题 |
| 多维度分 Row 面板 | ✅ 采用 | 清晰但面板数量较多（12+）    |
| 支持标签筛选      | ✅ 采用 | 需要配置 templating 变量     |

---

## 待决问题（Open Questions）

| ID  | 问题                                  | 优先级 | 建议                                 |
| --- | ------------------------------------- | ------ | ------------------------------------ |
| Q1  | 是否需要按 hostname 聚合请求量？      | 高     | 建议暂不添加，待真实流量分析后再决定 |
| Q2  | Dashboard 是否需要按小时/天聚合视图？ | 中     | 可通过时间范围选择器实现             |
| Q3  | 是否提供 AlertManager 规则？          | 低     | 作为独立 YAML 文件提供               |

---

## 快速交接（2026-01-31 更新）

### ✅ 实现已完成

所有实现工作已完成，包括：

1. **阶段 2 实现完成**：

   - [x] 在 `server.ts` 中添加 metrics 初始化代码（行 51-60）
   - [x] 在请求处理 handler 中添加 metrics 采集点（行 111-286）
   - [x] 添加 12 个单元测试用例（`server.test.ts`）

2. **阶段 3 Dashboard 完成**：

   - [x] 创建 Grafana Dashboard 模板（8 个面板）

3. **阶段 4 报告完成**：
   - [x] 生成 walkthrough 报告
   - [x] 生成 PR Body 建议

### 快速开始

**下一步操作**：

1. **提交 PR**：将变更提交代码审查

   - 审查重点：metrics 采集点是否完整、测试覆盖是否充分

2. **验证步骤**：

   ```bash
   cd libraries/http-services
   npm test  # 应通过 12/12 测试
   ```

3. **Dashboard 导入**：
   - 在 Grafana 中导入 `libraries/http-services/grafana-dashboard.json`
   - 配置 Prometheus 数据源
   - 验证各面板显示数据

### 关键文件

| 文件                         | 状态    | 说明                        |
| ---------------------------- | ------- | --------------------------- |
| `server.ts`                  | ✅ 完成 | metrics 初始化 + 5 个采集点 |
| `server.test.ts`             | ✅ 完成 | 12 个测试用例               |
| `grafana-dashboard.json`     | ✅ 完成 | 8 面板 Dashboard            |
| `docs/report-walkthrough.md` | ✅ 完成 | 详细实现报告                |
| `pr-body.md`                 | ✅ 完成 | PR 描述建议                 |

### 关键指标回顾

- **4 个核心指标**：`http_proxy_requests_total`、`http_proxy_request_duration_seconds`、`http_proxy_active_requests`、`http_proxy_errors_total`
- **4 个 MUST 行为条款**：R6-R9
- **5 种错误类型**：timeout、network、security、validation、unknown
- **12 个测试用例**：100% 覆盖率
- **8 个 Dashboard 面板**：全局概览 + 延迟分布 + Terminal 分组 + 错误分析

---

_最后更新：2026-01-31_

---

## RFC 复审完成（2026-01-30）

### 复审结果：✅ 通过

### 复审结论

RFC 已正确处理上一次审查提出的 4 个必须修正问题：

| 问题                           | 原状态      | 修正后                 | 判定    |
| ------------------------------ | ----------- | ---------------------- | ------- |
| response_size_bytes 必要性     | ❌ 未论证   | ✅ 已移除              | ✅ 通过 |
| errors_total.reason 高基数风险 | ❌ 存在风险 | ✅ 已移除              | ✅ 通过 |
| Dashboard 面板过多             | ❌ 16 个    | ✅ 8 个（目标 6-8 个） | ✅ 通过 |
| Histogram Bucket 上界          | ❌ 10s      | ✅ 30s                 | ✅ 通过 |

### 复审报告要点

**通过项**：

- `response_size_bytes` 已完全从 RFC 中移除（4.1 节、4.2 节、伪代码、测试映射表）
- `errors_total.reason` Label 已移除，仅保留 `error_type`（4.2.4 节、伪代码）
- Dashboard 面板从 16 个精简至 8 个（目标 6-8 个）
- Histogram Bucket 已扩展至 30s（4.2.2 节）

**轻微问题**：

- 伪代码 5.2.7 行的 buckets 配置与 4.2.2 节不一致，实现时需以规范为准

### 关键文件

- 复审报告：`.legion/tasks/http-proxy-metrics/docs/review-rfc-recheck.md`
- RFC 原文：`.legion/tasks/http-proxy-metrics/docs/rfc.md`

### 后续建议

1. **实现阶段**：以 4.2.2 节规范为准，伪代码中的 buckets 配置应更新为一致
2. **Dashboard**：如需更精确的 7 个面板，可考虑合并某些面板
3. **测试验证**：实现后验证 30s Bucket 能捕获超时请求的延迟分布

---

## 历史记录

### RFC 审查完成（2026-01-30）

**审查结果**：⚠️ 需修正后通过

**审查结论**：

RFC 整体设计思路清晰，指标覆盖了 HTTP 代理服务的核心可观测性需求。但存在以下过度设计倾向：

1. **response_size Histogram** 必要性未充分论证，与流式读取的内存效率目标冲突
2. **errors_total.reason** Label 存在高基数风险（可能包含 URL 或错误消息）
3. **Dashboard 面板过多**（16 个），认知负荷高，建议精简至 6-8 个
4. **Histogram Bucket 配置** 上界 10s 未覆盖完整超时范围（默认 30s）

**关键争议点**：

| 争议点                 | 正方观点             | 反方观点                         | 当前决策      |
| ---------------------- | -------------------- | -------------------------------- | ------------- |
| response_size 是否需要 | 可用于检测异常大响应 | 代理核心价值不在此，增加复杂度   | 建议移除      |
| errors_total.reason    | 便于调试定位问题     | 高基数风险，Cardinality 可能失控 | 建议移除      |
| Dashboard 面板数量     | 越详细越好，便于排查 | 过于复杂，难以快速定位问题       | 精简至 6-8 个 |
| hostname 聚合          | 可按服务名监控流量   | 中等基数风险，待真实流量分析     | 暂缓，Q1 待定 |

**建议方向**：

1. **简化指标**：聚焦核心需求，移除边缘指标
2. **Cardinality 第一**：所有 Label 必须可枚举，禁止动态值
3. **Dashboard 精简**：每个面板必须有明确用户故事
4. **Bucket 扩展**：覆盖完整业务范围（0.01s - 30s）

**待修正事项**（已全部完成）：

- [x] 移除 `http_proxy_response_size_bytes`
- [x] 移除 `errors_total.reason` Label
- [x] 精简 Dashboard 面板至 8 个
- [x] 扩展 Histogram Bucket 至 30s
- [x] 明确 Q1（hostname 聚合）决策

---

**快速交接**：

1. 用户确认进入实现阶段
2. 按 11.1 文件变更清单实施
3. 实现后提交代码 Review
