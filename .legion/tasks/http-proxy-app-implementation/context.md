# HTTP Proxy App Implementation - 上下文

## 会话进展 (2026-01-28)

### ✅ 已完成

- 完成 RFC 文档，路径：.legion/tasks/http-proxy-app-implementation/docs/rfc.md
- 完成 Specs 文档（dev/test/bench/obs），路径：.legion/tasks/http-proxy-app-implementation/docs/spec-dev.md / spec-test.md / spec-bench.md / spec-obs.md
- 完成设计自检报告并发起用户确认请求
- 用户已确认设计审批（待在 tasks.md 勾选）
- 在 tasks.md 记录并勾选“设计审批通过（用户确认）”
- 修订 RFC/spec-dev/spec-test/spec-obs 以补齐安全默认、allowedHosts、labels 与资源限制配置
- 闭环设计 Review 阻塞项
- 补齐 @yuants/app-http-proxy 的 package.json 与编译配置
- 实现 HTTP Proxy 启动入口与环境变量校验（ALLOWED_HOSTS/ALLOW_INSECURE_WS 等）
- 完成 labels/options 映射并注册 HTTP Proxy 服务
- 增加 HOST_URL 协议校验、默认并发/排队上限与数值范围校验
- 移除未使用的 @yuants/utils 依赖
- 安全审查阻塞项已闭环
- 构建验证通过：`rushx build`（apps/http-proxy），未出现 tsc 报错（仅提示 Node 版本未测试与项目未注册警告）
- 移除 apps/http-proxy/tsconfig.json 中无效的 heft-jest 类型引用以修复构建失败
- 根据 apps/http-proxy/src/index.ts 更新 RFC/spec-dev/spec-test/spec-obs/report-walkthrough/pr-body 文档
- 完善 graceful shutdown：信号只处理一次、5s 超时强制退出、异常兜底
- 按你的 rxjs 流重写 graceful shutdown，去掉 timeout/promise 并在 RxJS tap 中完成清理
- 同步更新 spec-dev/spec-obs 文档
- 用 RxJS race+timer 实现 shutdown 超时，保持在流内处理并更新 spec-dev/spec-obs 文档

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                            | 原因                                                                   | 替代方案                                                   | 日期       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 采用单一入口 `src/index.ts` 作为胶水层启动 HTTP Proxy 服务                      | 需求明确要求简单实现，仅需启动 terminal 并注册服务                     | 引入多模块或复杂配置系统以扩展功能；本次不采用，避免复杂化 | 2026-01-28 |
| 默认要求配置 ALLOWED_HOSTS，且非本地 ws:// 需显式允许                           | 避免开放代理与明文链路风险，满足安全审查要求                           | 默认放开 allowedHosts 或允许任何 ws://；已弃用             | 2026-01-28 |
| 为 CONCURRENT/MAX_PENDING_REQUESTS/ MAX_RESPONSE_BODY_SIZE 设置默认值与范围校验 | 满足安全审查的 secure-by-default 要求并避免资源耗尽                    | 完全不设默认值，依赖调用方；已弃用                         | 2026-01-28 |
| 测试阶段采用包内构建验证（rushx build）作为最小可运行检查                       | @yuants/app-http-proxy 仅定义 build 脚本且无测试脚本，优先执行编译验证 | 运行全仓 `rush build` 或集成测试；成本更高且不必要         | 2026-01-28 |
| graceful shutdown 设置 5s 超时强制退出                                          | 避免 dispose/terminal.dispose 卡住导致进程悬挂                         | 不设置超时，依赖事件循环自行退出；已弃用                   | 2026-01-28 |
| graceful shutdown 保持在 RxJS 流内处理，去掉 timeout/promise                    | 与当前实现风格一致，避免额外控制流                                     | 保留超时与 async 清理；本次不采用                          | 2026-01-28 |
| 使用 RxJS race(timer, cleanup$) 提供 shutdown timeout 能力                      | 保持 shutdown 逻辑完全在 RxJS 流内，同时具备超时保障                   | setTimeout 或 Promise 逻辑；不采用                         | 2026-01-28 |

---

## 快速交接

**下次继续从这里开始：**

1. 复核 walkthrough 与 PR body 文档，路径：`.legion/tasks/http-proxy-app-implementation/docs/report-walkthrough.md`、`.legion/tasks/http-proxy-app-implementation/docs/pr-body.md`
2. 如需进一步验证，可运行 HTTP Proxy 启动检查与最小运行流程
3. 如需更强覆盖，可补充集成验证

**注意事项：**

- 构建验证已通过，可将之前的构建失败阻塞视为已解除
- Walkthrough 与 PR body 已生成，可直接用于评审与提交

---

_最后更新: 2026-01-28 21:51 by Claude_
