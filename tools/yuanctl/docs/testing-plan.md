# yuanctl 测试策略与脚手架（配置 / get / watch / logs）

> 目标：为核心路径制定可执行的测试计划，并给出落地脚手架。覆盖 config 解析、get/watch 查询、logs 读取与 follow 行为。优先使用现有 Heft/Jest 测试框架（`rushx test`）。

---

## 总体策略

- **分层测试**：配置解析用单元测试；资源客户端与 CLI 动词用集成/契约测试（mock Terminal）；命令输出用 snapshot/文本断言。
- **最小依赖**：通过 stub Terminal/Channel/Service 返回值，避免真实 Host；必要时用 fixture TOML/环境变量覆盖。
- **验证重点**：参数优先级（flag/env/config）、过滤/选择器、确认/错误提示、日志 tail/follow 行为与边界（大文件、无匹配、多匹配）。

---

## 用例列表（按阶段落地）

### 配置解析（Unit）

- `context` 解析优先级：flag > env > config；默认使用 `DEFAULT_CONTEXT_NAME`；缺失配置时输出友好错误。
- TOML 字段映射：`hosts.*`、`contexts.*` 正确解析可选字段（`tls_verify`、`connect_timeout_ms` 等）；缺失 `host_url` 报错。
- `config-init`：输出包含默认 host/context 样例；终端 ID 默认 `Yuanctl/${HOSTNAME}`。

### get / describe（Integration）

- selector 与 field-selector 合并：`enabled=true,id=foo` 生成正确 where 子句；布尔字段校验非法值报错。
- `get deployments --watch`: 使用 mocked `deployments.watch` 返回两批数据，验证屏幕清空与时间戳输出（可断言尾行）。
- `describe deployment/<id>`：无匹配返回错误码；多匹配时按限制展示。
- `describe nodeunits`：未指定 identifier 时应尊重 selector/filter 或提示需要唯一目标。

### enable / disable / delete / restart（Integration）

- 需要 identifier/selector，否则报错；`--force-confirm` 路径在确认拒绝时不执行。
- restart 策略解析：`touch/graceful/hard` 与 `--grace-period`（数字/ms/s）；无效策略报错。

### logs（Integration）

- `logs deployment/<id> --tail=N`：在模拟 200+ 行内容下截取正确尾部；大文件（>128 KiB）时需验证实际截尾策略（当前行为需记录）。
- `logs -f`：订阅 Channel，收到多段消息按 prefix/timestamps 组合输出；错误时退出码为 1。
- `--since` 行为：当前未实现，需测试提示与忽略逻辑；后续若实现再更新用例。
- `--node-unit` 选择：未提供且无 address/default_node_unit 时应报错。
- `deploymentlogs` 别名：资源解析后命令接受并路由到相同实现（需补充实现后测试）。

---

## 脚手架建议

- **测试框架**：沿用 Heft/Jest；在 `src/__tests__/` 下新增 `config.test.ts`、`cli-get.test.ts`、`cli-logs.test.ts` 等。
- **Terminal mock**：
  - 提供 `createMockTerminalGateway` 返回注入的 list/watch/logs 行为（使用 RxJS `of`/`Subject`）。
  - 对 logs follow 使用 `Subject` 推送行，模拟错误分支。
- **CLI 调用**：使用 Clipanion `Cli.run` 传入 argv + mock stdout/stderr，断言输出字符串（可用 snapshot）。
- **Fixtures**：添加 `__fixtures__/config/valid.toml`、`missing_host.toml` 等，用 fs 读取；为 env/flag 覆盖提供 helper。
- **CI 命令**：`rushx test`；如需局部运行 `cd tools/yuanctl && pnpm test -- <pattern>`（保持 doc 同步）。

---

## 开放问题 / 后续补充

- 大日志截尾策略：是否需要流式按行 tail（避免 128 KiB 限制），待差异修复阶段处理。
- `--since` 语义：需明确 Node Unit 服务支持情况后决定实现或文档化限制。
- E2E：可用 `scripts/run-yuanctl-e2e.js` 结合本地/测试 Host，需准备样例配置与安全开关。
