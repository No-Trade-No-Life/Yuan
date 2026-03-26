# 代码审查报告

## 结论

PASS

本轮复核聚焦的 4 个问题已收敛：

- `grace-period`：已收敛，当前会拒绝非法值与负数。
- `config key/url`：已收敛，配置写入路径有 key/url 校验，运行态全局 `--host-url` 也已在配置加载层统一校验。
- `namespace help`：已收敛，`yuanctl <namespace> --help` 会返回 namespace 级帮助。
- 全局 `--host-url` 运行时校验：已收敛，非法 scheme / 内嵌凭证 URL 不会进入真实连接路径。

## 阻塞问题

- 无。

## 建议（非阻塞）

- `tools/yuanctl/src/config/clientConfig.ts:23-37` / `tools/yuanctl/src/namespaces/config/index.ts:69-82` - URL 校验逻辑目前有两份实现，建议下沉为共享校验函数，避免后续写入路径与运行路径再次漂移。
- `tools/yuanctl/src/config/__tests__/clientConfig.test.ts:33-42` - 建议补两类回归测试：非法 scheme（如 `http://` / `file://`）与内嵌凭证 URL（如 `ws://user:pass@host`），把运行态 `--host-url` 安全约束锁死。
- `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts:216-227` - 目前 CLI 侧只覆盖了 `config init` 的非法 URL，建议再加一条真实运行命令（如 `deploy list --host-url ...`）的失败用例，验证错误不会绕过到连接阶段。

## 修复指导

1. 抽取 `src/config/validation.ts` 之类的共享校验模块，统一承载 host URL / config key 校验。
2. 在 `loadClientConfig` 与 `config` namespace 中复用同一份校验函数，避免规则分叉。
3. 增加运行态 `--host-url` 非法输入回归测试，优先覆盖：`file://`、`http://`、`ws://user:pass@host`、合法 `wss://host/ws`。

[Handoff]
summary:

- 已按当前最新代码状态完成 `tools/yuanctl` 最终审查。
- 重点复核的 `grace-period`、`config key/url`、`namespace help`、全局 `--host-url` 运行时校验均已收敛。
- 结论为 PASS，仅剩少量可维护性与测试覆盖建议。
  decisions:
- (none)
  risks:
- URL 校验逻辑仍有重复实现，后续改规则时存在漂移风险。
  files_touched:
- path: /Users/c1/Work/agent-access/.legion/tasks/yuanctl-cli/docs/review-code.md
  commands:
- (none)
  next:
- 如需进一步加固，补运行态 `--host-url` 非法输入回归测试。
  open_questions:
- (none)
