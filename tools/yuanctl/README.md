# yuanctl

`yuanctl` 是一个 kubectl 风格的命令行工具，用于管理 Yuants 的部署与节点。它复用了 Web 控制台相同的 Terminal、SQL 与日志通道能力，旨在为运维与研发人员提供一致、脚本友好的操作体验。

## 功能速览

- `get`、`describe`、`logs` 等查询类命令支持 `--selector`、`--field-selector`、`--watch`、`--follow` 等常用参数。
- `enable`、`disable`、`restart` 支持批量筛选，可配合 `--force-confirm` 进行安全防护；`delete` 默认强制确认。
- 通过 `config-init` 输出符合 XDG 目录规范的 TOML 配置模板，便于多环境、多 Host 管理。
- 表格渲染、JSON/YAML 输出和 log streaming 均与 Web 控制台保持一致。

更多设计背景可参考 [`docs/deployment-cli-design.md`](./docs/deployment-cli-design.md)。

## 前置要求

- Node.js：`>=18.15.0 <19.0.0` 或 `>=22.11.0 <23.0.0`（与仓库 `rush.json` 保持一致）。
- pnpm：由 Rush 脚本自动管理，无需手动安装。
- 仓库已完成 `rush install`（或 `node common/scripts/install-run-rush.js install`）。

> 本包依赖 Rush + Heft 构建体系，建议在仓库根目录执行所有命令。

## 安装步骤

```bash
# 1. 安装依赖
node common/scripts/install-run-rush.js install

# 2. 构建 yuanctl
node common/scripts/install-run-rush.js build --to @yuants/tool-yuanctl

# 3. 查看帮助确认安装成功
node tools/yuanctl/lib/bin/yuanctl.js --help
```

默认构建产物位于 `tools/yuanctl/lib`，`package.json` 的 `bin` 字段已经将 `yuanctl` 指向 `lib/bin/yuanctl.js`。

### 全局安装

构建完成后，可选择发布到私有 npm 或直接在本机全局安装：

```bash
npm install -g @yuants/tool-yuanctl

# 验证命令是否可用
yuanctl --help
```

CLI 会缓存全局安装路径，无需额外环境变量。需卸载时执行 `npm uninstall -g @yuants/tool-yuanctl`。

> 提示：`yuanctl` 会在最多 24 小时检查一次 npm 上的最新版本，并在启动时提醒升级。若运行在离线环境，可通过设置 `YUANCTL_DISABLE_UPDATE_CHECK=1` 禁用该提示。

## 初次配置

运行 `config-init` 生成默认配置模板：

```bash
node tools/yuanctl/lib/bin/yuanctl.js config-init > ~/.config/yuan/config.toml
```

模板示例：

```toml
current_context = "prod-ops"

[hosts.prod]
host_url = "wss://prod-host.example/ws"
tls_verify = true
connect_timeout_ms = 5000
reconnect_delay_ms = 2000
terminal_id = "Yuanctl/${HOSTNAME}"

[contexts."prod-ops"]
host = "prod"
default_node_unit = "node-unit-address"
terminal_id = "Yuanctl/prod-ops"
```

- `hosts.*` 描述可连接的 Host 终端。
- `contexts.*` 用于快速切换 Host 和默认 Node Unit。
- 可通过命令行参数覆盖配置：`--context`、`--host-url`、`--selector` 等。

配置搜索顺序遵循 XDG 规范：`$XDG_CONFIG_HOME/yuan/config.toml` → `~/.config/yuan/config.toml` → `~/.yuan/config.toml`。

## 常用命令

```bash
# 查看部署列表（默认 table 输出）
yuanctl get deployments

# 以 JSON 输出单个部署
yuanctl get deployment/<id> -o json

# 持续 watch 部署变化
yuanctl get deployments --watch

# 描述部署详情
yuanctl describe deployment/<id>

# 开启 / 停用部署
yuanctl enable deployment/<id>
yuanctl disable deployment/<id>

# Touch / Graceful / Hard 重启
yuanctl restart deployment/<id> --strategy=graceful --grace-period=5s

# 删除部署（命令会强制二次确认）
yuanctl delete deployment/<id>

# 跟随日志
yuanctl logs deployment/<id> -f --timestamps
```

完整命令与选项可通过 `yuanctl --help` 与 `yuanctl <command> --help` 查看。

## 故障排查

- `Config not found`：确认配置文件已生成并放置于 XDG 目录，或通过 `--host-url` 临时指定。
- `Timed out while connecting to host`：检查 Host 地址是否可达，必要时调整 `connect_timeout_ms`。
- `Unable to determine node unit address`：在 `contexts.*` 中设置 `default_node_unit` 或执行命令时添加 `--node-unit`。

若需更深入的实现细节与后续路线图，请参考 `docs/deployment-cli-design.md`。
