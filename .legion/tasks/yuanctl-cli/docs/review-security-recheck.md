# 安全审查报告

## 结论

PASS

本轮只读复核 `tools/yuanctl` 当前改动后，之前指出的 4 个安全 blocking issues 已完成收敛：

- capability gate：已落地 capability class，并对 `write` / `destructive` / `read-sensitive` 执行门禁；未启用的 `remote-proxy` 默认阻断。见 `tools/yuanctl/src/cli/safety.ts:5-57`、`tools/yuanctl/src/cli/static-registry.ts:5-10`。
- deploy 输出最小化：`deploy list` / `deploy inspect` 已通过 `sanitizeDeployment` 去除 `command` / `args` / `env` 等敏感字段，只保留最小必要元数据。见 `tools/yuanctl/src/namespaces/deploy/index.ts:9-18,68-83`。
- 错误脱敏：未知异常统一折叠为 `E_INTERNAL / Internal error`，运行时建连失败也只返回泛化错误，未把底层异常直接透出到终端。见 `tools/yuanctl/src/cli/error.ts:35-48`、`tools/yuanctl/src/cli/runtime-context.ts:106-113`、`tools/yuanctl/src/bin/yuanctl.ts:4-10`。
- config 写入安全：配置写入改为同目录临时文件 + `0600` 权限 + 原子 `rename`，同时补充配置 key/URL 校验，避免凭证嵌入 URL。见 `tools/yuanctl/src/namespaces/config/index.ts:59-90`。

## 阻塞问题

- [x] 本轮未发现仍会阻碍 Phase 1 的安全阻塞项。

## 建议（非阻塞）

- `tools/yuanctl/src/namespaces/config/index.ts:84-90`：可继续加固为“随机临时文件名 + 独占创建 + fsync 父目录”，进一步降低本地文件系统竞态风险。
- `tools/yuanctl/src/cli/output.ts:123-124`：当前会输出 `details`；虽然本轮路径未见敏感数据注入，但后续新增错误码时建议默认不直出 `details`，仅在 `--output json` 或 debug 模式暴露。
- `tools/yuanctl/src/namespaces/deploy/index.ts:122-151`：`deploy logs` 已有限流（128 KiB + tail 上限），建议后续补充监控/审计埋点，记录敏感读取类命令的调用上下文。
- `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts:195-223`：建议补 3 类回归测试：`deploy inspect` 不回显 `env/args`、未知异常不泄露底层 message、config 文件权限保持 `0600`。

## 修复指导

- Phase 1 可继续推进，无需因当前安全问题阻塞。
- 若进入下一轮加固，优先顺序建议：
  1. 补配置写入竞态/权限回归测试；
  2. 收紧错误 `details` 默认输出策略；
  3. 为 `read-sensitive` / `write` 命令补审计与监控字段。

[Handoff]
summary:

- 已复核 `tools/yuanctl` 当前改动，之前 4 个安全 blocking issues 均已收敛。
- 当前结论为 PASS，未发现阻碍 Phase 1 的剩余安全阻塞项。
  decisions:
- (none)
  risks:
- 配置写入仍可进一步加固为随机临时文件 + 独占创建，但当前不足以阻塞 Phase 1。
- table 模式默认输出 error.details，后续扩展错误码时需防止重新引入信息泄露。
  files_touched:
- path: .legion/tasks/yuanctl-cli/docs/review-security-recheck.md
  commands:
- (none)
  next:
- 如需继续加固，先补权限/脱敏/最小输出的回归测试。
- 后续若引入新的 sensitive capability，沿用现有 capability class 并补审计策略。
  open_questions:
- (none)
