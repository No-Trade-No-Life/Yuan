# 测试报告

## 执行命令

`workdir=/Users/zccz14/Projects/Yuan/libraries/protocol npm run build`

## 结果

PASS

## 摘要

- 构建命令执行成功，`@yuants/protocol` 的 build/test/api-extractor/post-build 链路均完成。
- Heft 测试阶段返回 `No tests found, exiting with code 0`，无失败用例。
- API Extractor 成功完成，未出现阻断错误。

## 失败项（如有）

- 无。

## 备注

- 为什么选这个命令：用户在执行指令中明确指定 `workdir=/Users/zccz14/Projects/Yuan/libraries/protocol npm run build`，直接按要求执行可最低成本覆盖该包关键验证路径。
- 考虑过的备选项：
  - `npm test`：覆盖范围更窄，无法验证 API Extractor 与 post-build。
  - 仓库根目录 `rush build`：覆盖更大但成本更高，超出本次 scope 的最小验证需要。
- 补充观察：日志存在 TypeScript 5.9.3 与 API Extractor bundled TS 5.8.2 的版本提示，但不影响本次结果（命令退出码为 0）。
