name: yuan-tools
description: 面向 tools/ 目录（脚本、CLI、运维工具）的 Credential 使用准则，供自动化任务唯一参照。

---

# tools/ 目录 Agent 指南（Credential 版）

> 本文档指导命令行工具、脚本与自动化任务如何读取、传递并保护 TypedCredential。

---

## 1. 工具类任务的定位

- 这些脚本通常桥接 Terminal、CI、外部系统，需要遵循与 apps/ 相同的凭证约束。
- 工具不得直接保存在仓库中的明文凭证，应通过环境变量或安全存储注入。

---

## 2. Credential 操作准则

1. **输入来源清晰**：所有脚本接受 `--credential-file`、环境变量或标准输入三种方式之一，禁止硬编码。
2. **TypedCredential 贯穿全程**：
   - 解析后立即校验 `type` 字段，与工具职责匹配才继续执行。
   - 下游 API 调用统一使用 `(credential, params)` 函数签名。
3. **最小权限**：
   - 命令仅申请执行当前任务所需权限；
   - 若需要额外 scope，务必记录原因。
4. **不可自循环调用**：工具只响应显式触发，不得定时轮询自己暴露的服务。

---

## 3. 典型实现结构

```text
src/
  device/     # 可选，封装原始网络访问
  api/        # 复用 apps/ 的 API 层模式
  services/   # 实际 CLI/脚本入口，组合业务
```

- **设备层**：需要固定 IP、代理或速率控制的脚本在此实现。
- **API 层**：封装 HTTP/WebSocket 调用，公共与私有接口分开。
- **服务层**：处理 CLI 参数解析、日志，最后调用库函数。

---

## 4. 安全与运维要求

- 记录所有对外 IP、速率限制或依赖的第三方账号到 `SESSION_NOTES`。
- 任何缓存或临时文件需使用 `credential.type` + hash 命名并定期清理。
- 遇到凭证失效、权限拒绝时，向上抛出明确错误而不是静默重试。

---

## 5. Checklist

- [ ] 入口脚本是否声明 Credential 输入方式并校验 `type`？
- [ ] 是否复用了 libraries/ 中提供的 TypedCredential 工具？
- [ ] API/订阅调用在退出时是否释放资源？
- [ ] 是否避免把凭证写入日志或临时文件？
- [ ] 需要固定设备层的脚本是否在文档中列出基础设施要求？

---

> `.clinerules/credential.md` 仅摘录本文件要点供工具链查阅，如有冲突以本文件为准。
