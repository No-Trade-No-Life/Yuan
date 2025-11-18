name: yuan-libraries
description: 面向 libraries/ 目录的 Credential 协作规范，为共享库实现的权威来源。

---

# libraries/ 目录 Agent 指南（Credential 版）

> 本文档帮助负责共享库的 Agent 对齐 Credential 语义，确保各 app 在相同抽象下工作。

---

## 1. 共享库的责任

- 把通用 Credential 逻辑（建模、校验、序列化、调度）抽象出来，供 apps/ 与 tools/ 复用。
- 避免在库中引入具体 vendor 耦合；如必须，需在 README 中标注适用范围。
- 所有导出的函数都要清晰区分“需要 Credential”与“无需 Credential”的调用方式。

---

## 2. Credential 建模原则

1. **类型可追踪**：提供 `TypedCredential` 的 TypeScript 类型定义或辅助构造器。
2. **结构由 vendor 决定**：库层不强行添加字段，只提供校验和互转工具。
3. **无状态处理**：库函数不得持久化 Credential，仅在当前调用上下文内使用。
4. **缓存规范**：如提供缓存封装，默认以 `(credential.type, hash(credential.payload), params)` 作为 key，防止数据串线。

---

## 3. 推荐模块结构

- `data-account` / `data-order`：暴露 `provide*ActionsWithCredential`，供服务层注入。
- `protocol` / `kernel` / 其他子库：
  - 将需要 Credential 的函数设计为 `(credential, params) => Promise<Result>`。
  - 对订阅类函数暴露 `(credential, params) => Observable<Event>` 并提供 `.unsubscribe()` 机制。
- 若需要封装设备层或 API 层 SDK，请将实现放在 `src/api`/`src/device` 子目录，并通过 index 导出。

---

## 4. 与 apps/、tools/ 的协作

- 提供统一的 `TypedCredential` 校验器，避免每个 app 重写。
- 导出 mock / stub，方便测试在无真实凭证时运行。
- 对外暴露的错误需区分“凭证无效”“权限不足”“网络异常”等语义，方便上层决定是否重试。

---

## 5. 自检清单

- [ ] 导出的类型是否标注 `credential: TypedCredential` 的必填性？
- [ ] 是否避免在库中读取环境变量形式的凭证？（改由调用方注入）
- [ ] 缓存/重试策略有没有以 Credential 作为隔离维度？
- [ ] 订阅/长连接是否提供清理钩子并在文档中说明？
- [ ] 任何额外的 vendor 假设是否写入库 README？

---

> `.clinerules/credential.md` 会从本文件抽取片段供外部引用，如有差异以本文件为准。
