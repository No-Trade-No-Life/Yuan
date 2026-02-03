# HTTP Proxy Service 实现 - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 14/14 任务完成

---

## 阶段 1: 阶段 1: 包基础设施搭建 🟡 IN PROGRESS

- [x] 创建 libraries/http-services 目录结构 | 验收: 目录存在且包含 src/, config/, .heft/ 子目录
- [x] 创建 package.json，配置依赖和构建脚本 | 验收: package.json 包含正确的依赖（@yuants/protocol, @yuants/utils）和 build 脚本
- [x] 创建 TypeScript 配置文件（tsconfig.json） | 验收: tsconfig.json 符合 Yuan 仓库规范，extends 正确的 base config
- [x] 创建 API Extractor 配置 | 验收: config/api-extractor.json 存在且配置正确

---

## 阶段 2: 阶段 2: 类型定义 🟡 IN PROGRESS

- [x] 定义 IHTTPProxyRequest 接口（包含 url, method, headers, body 等 fetch 参数） | 验收: types.ts 中定义了完整的 HTTP 请求参数类型
- [x] 定义 IHTTPProxyResponse 接口（包含 status, statusText, headers, body） | 验收: types.ts 中定义了 HTTP 响应类型，包含原始响应数据
- [x] 定义 IHTTPProxyOptions 接口（包含 allowedHosts, maxResponseBodySize） | 验收: types.ts 中包含 IHTTPProxyOptions

---

## 阶段 3: 阶段 3: Server 端实现 🟡 IN PROGRESS

- [x] 实现 provideHTTPProxyService 函数 | 验收: 函数接受 terminal, labels, serviceOptions 参数，返回 dispose 函数
- [x] 实现 HTTP 请求处理逻辑（使用 fetch） | 验收: 能够根据 IHTTPProxyRequest 发起真实 HTTP 请求并返回 IHTTPProxyResponse
- [x] 实现 SSRF 保护与响应体大小限制 | 验收: allowedHosts 校验与 maxResponseBodySize 限制生效

---

## 阶段 4: 阶段 4: Client 端实现 🟡 IN PROGRESS

- [x] 实现 requestHTTPProxy 函数 | 验收: 函数接受 terminal 与 request（包含 labels），返回 Promise<IResponse<IHTTPProxyResponse>>

---

## 阶段 5: 阶段 5: 测试与文档 🟡 IN PROGRESS

- [x] 编写单元测试 | 验收: 测试覆盖 provideHTTPProxyService 和 requestHTTPProxy 核心逻辑
- [x] 生成 API 文档 | 验收: 执行 build 后生成 etc/http-services.api.md
- [x] 实现 benchmark 脚本与阈值判定 | 验收: benchmarks/setup.ts 与 benchmarks/index.ts 可运行并输出 PASS/FAIL 与 ResultJSON

---

## 发现的新任务

(暂无)

- [x] 设计审批通过（用户确认） | 来源: 设计审批门禁流程
- [x] Walkthrough 报告生成完成 | 来源: User Request
- [x] 对齐 tasks.md 中过期条目（如 labels 注入/selector）与最新 Dev Spec | 来源: 发现 tasks.md 与 spec-dev.md 不一致
- [x] 执行测试/构建（`rush build -t @yuants/http-services`）并记录结果 | 来源: run-tests 未执行
- [x] 修复单元测试中的 WebSocketConnectionError 问题 | 来源: rush build failure
- [x] 修复 client.test.ts 和 server.test.ts 中的 WebSocket 连接错误与异步泄漏 | 来源: rush build 失败日志
- [x] requestHTTPProxy 改为 fetch 兼容接口（支持 Terminal 注入） | 来源: 用户需求
- [x] 完善 RFC：增加 server.ts 实现细节与基数控制安全说明 | 来源: Code Review

---

_最后更新: 2026-01-26 21:49_
