# Kubectl-Inspired Deployment CLI Design

## 1. Context & Observations

- Web 端 `DeploySettings` 页面基于 `deployments$` 流读取部署列表，本质是通过 `requestSQL` 执行 `select * from deployment order by created_at desc`（`ui/web/src/modules/Deploy/DeploySettings.tsx:57-139`, `ui/web/src/modules/Deploy/model.ts:46-63`）。
- 启用/禁用部署同样调用 `buildInsertManyIntoTableSQL` 写回 `deployment.enabled` 字段。
- 删除部署直接执行 `delete from deployment where id = ?` 并触发 `refreshDeployments$`（`DeploySettings.tsx:57-89`）。
- 实时日志依赖 Terminal 通道 `encodePath('Deployment','RealtimeLog', nodeUnitAddress)`（`DeploymentRealtimeLog.tsx:11-50`），Node Unit 负责 `tail -F` 推流（`apps/node-unit/src/index.ts:313-350`）。
- Node Unit 暴露 `Deployment/ReadLogSlice` 服务支持按偏移量读取日志片段（`apps/node-unit/src/index.ts:240-311`），并通过 `listWatch` 根据 `updated_at` 感知配置变更自动重启（`apps/node-unit/src/index.ts:355-393`）。

> 结论：CLI 可沿用 Terminal + SQL + 日志通道能力，只需封装成 kubectl 风格的资源操作命令。

## 2. 设计目标

**目标**

- 提供与 kubectl 类似的命令体验：动词 + 资源（`get deployments`、`describe deployment/<id>`、`logs deployment/<id>` 等）。
- 支持多 Host 上下文管理（仿 `kubectl config`），实现零散环境的快速切换。
- 所有命令复用现有 Yuants 基础设施，保持行为与 Web 控制台一致。
- 结构遵循开放封闭原则，便于未来引入更多资源与动词。

**非目标**

- 当前迭代不实现部署 YAML/JSON `apply`（可在后续基于 SQL 模板扩展）。
- 不处理 Node Unit 注册或安装；也不直接连接数据库（全部经由 Host）。
- 不负责日志持久化导出，仅提供终端流式展示。

## 3. 资源与动词映射

| 资源名                  | 说明                    | 数据来源                         |
| ----------------------- | ----------------------- | -------------------------------- |
| `deployments`           | 部署配置表 `deployment` | SQL 查询                         |
| `nodeunits`             | 在线 Node Unit 信息     | `terminal.terminalInfos$`        |
| `deploymentlogs` (虚拟) | 部署日志流              | `Deployment/ReadLogSlice` + 通道 |

核心动词（kubectl 风格）：

- **`get`** 获取资源集合或单个实例，支持针对 `deployment` 表字段（`id`、`address`、`package_name`、`enabled` 等）的筛选；`--selector` 接受 `field=value` 形式的逗号分隔列表，`--field-selector` 支持更精确的 `字段=值` 字符串。可结合 `--watch` 持续刷新，以及 `-o table|json|yaml|wide` 等多种输出。典型用例：`yuanctl get deployments --selector package_name=@yuants/bot`；`yuanctl get deployment/<id> -o json`；`yuanctl get deployments --field-selector enabled=true --watch`.
- **`describe`** 汇总资源详情，展示部署参数、运行节点与最近事件，筛选同 `get`。典型用例：`yuanctl describe deployment/<id>`；`yuanctl describe nodeunit/<addr> --field-selector address=<pubkey>`.
- **`enable`** 将部署置为启用状态，支持以 `id`、`address`、`package_name`、`enabled` 等字段筛选目标集合。默认不弹出确认，可通过 `--force-confirm` 显式开启。典型用例：`yuanctl enable deployment/<id>`；`yuanctl enable deployments --selector package_name=@yuants/bot`.
- **`disable`** 临时停用部署，让 Node Unit 在下一轮轮询时下线进程，筛选规则同上，`--force-confirm` 时才要求额外确认。典型用例：`yuanctl disable deployment/<id>`；`yuanctl disable deployments --selector address=<pubkey>`.
- **`delete`** 永久删除部署记录，支持字段筛选，执行时强制二次确认，防止误删。典型用例：`yuanctl delete deployment/<id>`；`yuanctl delete deployments --selector package_version=legacy`.
- **`restart`** 以不同策略重启部署：`touch` 更新 `updated_at`，`graceful` 先 disable 延迟再 enable，`hard` 立即 disable/enable`。同样可批量筛选，并可选 `--force-confirm`。典型用例：`yuanctl restart deployment/<id>`；`yuanctl restart deployments --field-selector enabled=true --strategy=graceful --grace-period=5s`.
- **`logs`** 读取或跟随部署日志，行为与 `kubectl logs` 对齐：`--follow/-f` 持续输出（`Ctrl+C` 结束），`--tail=<n>` 控制结尾行数（默认 200，最大 10_000），`--since=<duration>` 控制时间窗口，`--prefix/--timestamps` 输出时间戳或前缀。支持按字段筛选部署并在多 Node Unit 间切换。典型用例：`yuanctl logs deployment/<id> --tail=200`；`yuanctl logs deployment/<id> -f --node-unit=<addr> --since=30m`.
- **`config-init`** 输出默认配置模板，可重定向到配置路径或 stdout：`yuanctl config-init > ~/.config/yuan/config.toml`。

命令别名建议使用 `yuanctl`（如同 `kubectl`）。部署场景可提供 `deployctl` 软链接。

输出示例（参考实现期望值）：

```bash
$ yuanctl get deployments
NAME        PACKAGE              VERSION   ENABLED   NODE_UNIT        UPDATED
alpha-bot   @yuants/bot-alpha    1.2.3     true      node-01          2024-05-01T12:30:00Z
beta-bot    @yuants/bot-beta     2.0.0     false     node-02          2024-04-30T09:18:12Z

$ yuanctl describe deployment/alpha-bot
Name:           alpha-bot
Package:        @yuants/bot-alpha@1.2.3
Args:           ["--market", "crypto"]
Env:            {"NODE_ENV":"production"}
Enabled:        true
Node Unit:      node-01
Updated At:     2024-05-01T12:30:00Z
Linked Logs:    yuanctl logs deployment/alpha-bot --follow

$ yuanctl enable deployment/beta-bot
Deployment beta-bot enabled (was disabled)

$ yuanctl disable deployment/alpha-bot --yes
Deployment alpha-bot disabled (was enabled)

$ yuanctl delete deployment/beta-bot
? Delete deployment beta-bot? (y/N) y
Deployment beta-bot deleted

$ yuanctl restart deployment/alpha-bot --strategy=graceful --grace-period=5s
Restarting alpha-bot (graceful, wait 5s) ... done

$ yuanctl logs deployment/alpha-bot --tail=3 --prefix
[2024-05-01T12:31:00Z] alpha-bot :: Starting cycle #42
[2024-05-01T12:31:02Z] alpha-bot :: Fetching market data...
[2024-05-01T12:31:05Z] alpha-bot :: Cycle completed

$ yuanctl logs deployment/alpha-bot -f
[2024-05-01T12:32:00Z] alpha-bot :: Starting cycle #43
[2024-05-01T12:32:03Z] alpha-bot :: Fetching market data...
[... 持续输出，按 Ctrl+C 结束 ...]

$ yuanctl config-init
[hosts.prod]
host_url = "wss://example-host/ws"
tls_verify = true
connect_timeout_ms = 5000
reconnect_delay_ms = 2000
terminal_id = "Yuanctl/${HOSTNAME}"

[contexts.default]
host = "prod"
terminal_id = "Yuanctl/default"
```

## 4. CLI 命令结构

```
yuanctl [flags] <verb> <resource>[.subresource] [name|name/identifier]

动词集：
  get, describe, enable, disable, delete, restart, logs, config-init
资源层次：
  deployments
  deploymentlogs (只在 logs 动词下使用)
  nodeunits (只读)
```

Flag 体系：

- 全局：`--context/-c`、`--host-url`、`--namespace`（为未来扩展保留）、`--output/-o`、`--watch`、`--all-namespaces` 等。
- 资源过滤：
  - `--selector/-l`：逗号分隔的 `字段=值` 列表，字段限定为 `id`、`address`、`package_name`、`enabled` 等 `deployment` 表直接列名，按 `AND` 组合。
  - `--field-selector`：字符串形式的 `字段=值`，支持更精确表达，语义与 `--selector` 一致，未来可扩展比较运算。
- 日志：`--tail`、`--follow/-f`、`--since`、`--prefix` 等。

## 5. 配置与上下文（kubectl config 风格）

配置文件遵循 XDG 约定：优先读取 `$XDG_CONFIG_HOME/yuan/config.toml`，若未设置则回退到 `~/.config/yuan/config.toml`，再退到 `~/.yuan/config.toml`。CLI 在启动时解析该路径并合并命令行 flag 与环境变量；若目标路径缺失，需提示用户执行 `yuanctl config-init > ~/.config/yuan/config.toml` 或其它自选路径生成模板。

Toml 配置示例：

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
terminal_id = "Yuanctl/prod-ops"
```

配置结构体定义（TypeScript）：

```ts
export interface YuanCtlConfig {
  current_context?: string;
  preferences?: Record<string, unknown>;
  hosts: Record<
    string,
    {
      host_url: string; // 连接 Node Unit Host 的必填参数
      terminal_id?: string; // 默认为 Yuanctl/$HOSTNAME
      tls_verify?: boolean;
      connect_timeout_ms?: number;
      reconnect_delay_ms?: number;
    }
  >;
  contexts: Record<
    string,
    {
      host: string;
      default_node_unit?: string;
      terminal_id?: string; // 覆盖 hosts.* 中的默认 terminal_id
    }
  >;
}
```

当前连接 Node Unit Host 的硬性要求只有 `host_url`（通常为 `wss://` 地址）；其余字段如 `tls_verify`、`connect_timeout_ms`、`reconnect_delay_ms` 以及可选 `terminal_id` 用于调整 TLS 校验、连接超时/重连策略或覆盖默认终端身份。若未显式配置 `terminal_id`，CLI 默认使用 `Yuanctl/$HOSTNAME`。

**术语说明**

- `hosts`：保存可连接的 Host 端点，与原先设计中的 `clusters` 等价，主要存放 `host_url`、连接参数以及终端 ID 策略。一个配置文件可以记录多个 Host，便于随时切换。
- `contexts`：命名好的快捷组合，指向某个 `host` 并补充默认 Node Unit 与可选的 `terminal_id` 覆盖。若配置中未显式提供 `contexts`，CLI 默认以第一个 `host` 自动创建 `contexts.default` 并使用该上下文；若只有一个 Host 且配置简单，也可以跳过 `contexts`，直接通过 `--host-url` 运行。

**配置初始化**

- `yuanctl config-init` 仅写入标准输出，用户可通过重定向保存：`yuanctl config-init > ~/.config/yuan/config.toml`。
- 若启动时检测到配置缺失或不合法，`ClientConfig` 需输出友好提示，例如：`Config not found. Run "yuanctl config-init > ~/.config/yuan/config.toml" to create a template.`。
- 模板会包含至少一个 `host`，并在未提供 `contexts` 时自动生成与首个 host 对应的 `contexts.default`。

为什么首选 TOML：

- 语法稳定、易于手写，避免 YAML 那种多种等价写法导致的歧义。
- 提供字符串、数字、布尔、数组、表、日期时间等常见类型，比 JSON 更贴近“配置”。
- 几乎没有缩进、锚点、yes/no 等陷阱，降低协作编辑成本。
- 生态验证充分（`pyproject.toml`、`cargo.toml` 等），适合应用级配置。
- 一句话：TOML 是“给人写的配置”，YAML 更像“给工具写”，JSON 更适合“传输结构”。

解析优先级：命令行 flag > 环境变量 > 当前上下文 > 默认值。`TerminalGateway` 不直接处理 CLI flag，而是接收解析后的 `ClientConfig`。

## 6. 内部架构

```
┌──────────────────────────────────────┐
│ CLI Entry (bin/yuanctl)              │
├──────────────────────────────────────┤
│ RootCommand Tree (kubectl-like)      │
│  • Verb nodes                        │
│  • Resource resolvers                │
│  • Flag definitions                  │
├──────────────────────────────────────┤
│ ClientConfig                         │
│  • 解析 kubeconfig 风格配置          │
│  • 处理 context/host                 │
│  • 缺失配置时提示执行 config-init     │
├──────────────────────────────────────┤
│ TerminalGateway                      │
│  • Terminal 生命周期（懒加载/单例）  │
│  • 健康检查、重试（指数退避，上限 30s）|
│  • 连接超时（默认 10s，可由 config 定义）|
│  • 退出时自动断连与资源清理          │
├──────────────────────────────────────┤
│ Resource Clients                     │
│  `DeploymentsClient`                 │
│     - list/get/watch                 │
│     - enable/disable/delete/restart  │
│  `NodeUnitsClient`                   │
│     - list                           │
│  `LogsClient`                        │
│     - readSlice                      │
│     - follow                         │
├──────────────────────────────────────┤
│ Printer Layer                        │
│  • TablePrinter (kubectl table)      │
│  • JSON/YAML Serializer              │
│  • DescribeRenderer                  │
└──────────────────────────────────────┘
```

参考伪代码（结合 `ui/web/src/modules/Deploy/model.ts` 的 SQL 访问模式与 `apps/node-unit/src/index.ts` 的 Terminal 初始化逻辑）：

```typescript
// bin/yuanctl
async function main(rawArgs: string[]) {
  const cli = buildCommandTree(); // 动态注册动词/资源
  const { verb, resource, flags } = cli.parse(rawArgs);

  const configPath = resolveConfigPath(process.env); // 遵循 XDG -> ~/.config -> ~/.yuan
  const configResult = await new ClientConfig().load({
    configPath,
    env: process.env,
    overrides: flags,
  });
  if (!configResult.ok) {
    console.error(
      'Config not found or invalid. Run "yuanctl config-init > ~/.config/yuan/config.toml" to create one.',
    );
    process.exit(1);
  }
  const config = configResult.value;

  const gateway = await TerminalGateway.ensure(config.context);
  const context = { gateway, config, flags };

  const runner = resolveVerbHandler(verb, resource);
  await runner(context);
}

// src/cli/verbs/get.ts
export const runGet: VerbRunner = async ({ gateway, config, flags }) => {
  const client = resolveResourceClient(flags.resource, gateway);
  const printer = resolvePrinter(flags.output);

  if (flags.watch) {
    client
      .watch(flags)
      .pipe(retryBackoff(), share())
      .subscribe((items) => printer.print(items));
    await keepProcessAlive();
    return;
  }

  const items = await client.list(flags); // 复用 requestSQL 查询
  printer.print(items);
};
```

**Command Tree 实现要点**

- 使用 `@commander-js/extra-typings` 或 `oclif`, 或自研轻量 command tree，保证可扩展。
- 每个动词实现一个 `VerbModule`，注入资源操作，类似 kubectl 中的 `cmd/kubectl/app`.
- 支持插件：后续动词/资源可以通过注册表追加，而不修改核心逻辑。

## 7. 资源客户端细节

### 7.1 DeploymentsClient

- `list(options)`：封装 `requestSQL`，支持分页、过滤（SQL where 条件）。
- `get(id)`：单条查询。
- `enable/disable(id)`：构造 upsert SQL，更新 `enabled`。
- `delete(id)`：执行 delete SQL。
- `restart(id, strategy)`：
  - `touch`: 更新 `updated_at = now()`。
  - `graceful`: `disable → 延时 → enable`。
  - `hard`: `disable → wait=0 → enable`。
- `watch(options)`：使用 `repeat + retry` 与 RxJS `share` 实现 `kubectl get --watch`。

```ts
// src/client/deploymentsClient.ts
export class DeploymentsClient {
  constructor(private gateway: TerminalGateway) {}

  async list({ selector, fields }: ListOptions) {
    const sql = buildSelectSQL({
      base: 'select * from deployment order by created_at desc',
      selector, // 转换为 where/key = value
      fields,
    });
    return requestSQL(this.gateway.terminal, sql); // 同 ui/web/.../model.ts
  }

  async enable(id: string) {
    const row = await this.get(id);
    const payload = { ...row, enabled: true };
    const sql = buildInsertManyIntoTableSQL([payload], 'deployment', {
      columns: ['id', 'package_name', 'package_version', 'env', 'address', 'command', 'args', 'enabled'],
      conflictKeys: ['id'],
      returningAll: true,
    });
    return requestSQL(this.gateway.terminal, sql);
  }

  async restart(id: string, strategy: RestartStrategy = 'touch') {
    if (strategy === 'touch') {
      return requestSQL(
        this.gateway.terminal,
        `update deployment set updated_at = ${sqlNow()} where id = ${escapeSQL(id)}`,
      );
    }
    await this.disable(id);
    if (strategy === 'graceful') {
      await sleep(5_000);
    }
    return this.enable(id);
  }

  watch(options: ListOptions) {
    return defer(() => this.list(options)).pipe(
      repeat({ delay: 2_000 }),
      retry({ delay: 2_000 }),
      shareReplay(1), // 模仿 deployments$ 行为
    );
  }
}
```

### 7.2 NodeUnitsClient

- 订阅 `terminal.terminalInfos$`，筛选 tag `node_unit === 'true'`。
- 映射为 kubectl 中的 `nodes` 资源，供 `get nodeunits` 或 `describe nodeunit/<addr>`。

```ts
// src/client/nodeUnitsClient.ts
export class NodeUnitsClient {
  constructor(private gateway: TerminalGateway) {}

  list() {
    return this.gateway.terminal.terminalInfos$.pipe(
      switchMap((infos) => from(infos)),
      map((info) => info.tags ?? {}),
      filter((tags) => tags.node_unit === 'true'),
      map((tags) => ({
        address: tags.node_unit_address ?? '',
        name: tags.node_unit_name ?? '',
        version: tags.node_unit_version ?? '',
      })),
      toArray(),
    );
  }
}
```

### 7.3 LogsClient

- `readSlice(id, start)` → `Deployment/ReadLogSlice`。
- `follow(id, nodeUnitAddr)` → 通道订阅，支持多节点 fallback。
- 格式化输出：参考 `kubectl logs` 支持 `--prefix --timestamps --color`。

```ts
// src/client/logsClient.ts
export class LogsClient {
  constructor(private gateway: TerminalGateway) {}

  async readSlice({ deploymentId, start }: { deploymentId: string; start: number }) {
    const res = await this.gateway.terminal.callService('Deployment/ReadLogSlice', {
      deployment_id: deploymentId,
      start,
    }); // 对应 apps/node-unit/.../index.ts:240-311
    return res.data;
  }

  follow({ deploymentId, nodeUnit }: { deploymentId: string; nodeUnit: string }) {
    const channelId = encodePath('Deployment', 'RealtimeLog', nodeUnit);
    return this.gateway.terminal.channel
      .open(channelId, deploymentId) // 依赖 tail -F 推流
      .pipe(map((chunk) => formatLogLine(chunk)));
  }
}

// src/cli/verbs/logs.ts
export const runLogs: VerbRunner = async ({ gateway, flags }) => {
  const client = new LogsClient(gateway);
  if (flags.follow) {
    client
      .follow({ deploymentId: flags.name, nodeUnit: flags.nodeUnit })
      .subscribe((line) => process.stdout.write(line));
    await keepProcessAlive(); // 直到 Ctrl+C
    return;
  }
  const slice = await client.readSlice({ deploymentId: flags.name, start: flags.start ?? -4_096 });
  process.stdout.write(slice.content);
};
```

## 8. 输出与 UX

- `TablePrinter`：自研轻量表格渲染器，避免 `console.table` 的列宽/格式限制，支持：
  - 默认列：`NAME`(截断 ID)、`PACKAGE`、`VERSION`、`ENABLED`、`NODE_UNIT`、`UPDATED`；
  - `--no-headers`、`-o wide`（追加 `ARGS`、`ENV summary`）；
  - 列宽自适应 + 超长值省略号，必要时支持颜色和对齐；
  - 与 `--watch` 配合时在同一终端刷新（简易 diff/重绘）。
- `DescribeRenderer`：
  - Section：Metadata、Spec（package/args/env）、Runtime（enabled/updated/node unit）、Linked Logs（提示 `yuanctl logs` 命令）。
- 错误处理分类：
  - `ConfigError`、`ConnectionError`、`NotFoundError`、`OperationError`。
  - 输出风格：`Error: <type>: <message>`，附 `--debug` 详情。
- 交互提示：
  - 删除/重启前需确认，可用 `--yes` 跳过。
  - `enable/disable` 输出变更 diff。
  - `logs` 默认加色，可用 `--color=auto|always|never` 控制。

## 9. 目录结构（`tools/yuanctl`）

- `bin/yuanctl`：可执行入口，支持 shebang + Node loader。
- `src/cli/index.ts`：初始化 command tree（加载 Verb 模块）。
- `src/cli/verbs/get.ts`、`logs.ts` 等：每个动词一个文件。
- `src/cli/resources/deployments.ts`、`nodeunits.ts`：资源定义（字段、列、describe 逻辑）。
- `src/config/kubeconfig.ts`：解析/写入配置。
- `src/client/terminalGateway.ts`：Terminal 初始化。
- `src/client/deploymentsClient.ts`、`logsClient.ts`：客户端实现。
- `src/printers/*`：表格/JSON/YAML 渲染。
- `src/utils/*`：错误包装、时间格式化、确认提示等。
- `docs/examples/*.md`：示例命令与输出。

测试建议：

- `__tests__/cli/get.test.ts`：命令级集成（mock Terminal），涵盖 selector/field-selector 解析。
- `__tests__/cli/config-init.test.ts`：生成模板快照测试，确保 stdout 输出符合预期。
- `__tests__/client/deploymentsClient.test.ts`：SQL 调用单测（替换 requestSQL），验证 enable/disable/restart 语义。
- `__tests__/client/logsClient.test.ts`：`readSlice` 与 `follow` 行为（模拟 tail 通道）。
- `__tests__/utils/tablePrinter.test.ts`：宽度、省略、`--no-headers` 等格式化逻辑。

## 10. 实现路线

1. 创建 `tools/yuanctl` 包（参考现有 `tools/toolkit`），配置 TypeScript + tsup/tsc 构建。
2. 实现 `kubeconfig` 解析 & `ClientConfig`，验证多上下文切换。
3. 搭建 `TerminalGateway`（懒加载 + 全局复用 + 退出清理）。
4. 编写 `DeploymentsClient` / `LogsClient` / `NodeUnitsClient`。
5. 构建 `get` / `describe` / `logs` / `enable` / `disable` / `restart` / `delete` 动词。
6. 实现 `config-init` 模块，生成默认配置模板（支持输出到 stdout 或指定路径）。
7. 引入 Printer 层，确保 `-o json|yaml`、`--watch` 等行为正确。
8. 补充测试与文档示例。

## 11. 后续拓展（OCP）

- **apply**：支持 `yuanctl apply -f deployment.yaml`，解析为 SQL upsert。
- **rollout**：引入部署历史、状态监控（`yuanctl rollout status deployment/<id>`）。
- **exec/port-forward**：若 Node Unit 提供类似功能，可扩展资源。
- **插件机制**：允许通过约定目录注册新动词/资源，仿 `kubectl plugin`。
- **RBAC**：结合 Host 权限模型，为不同上下文配置 API 访问范围。

---

通过模仿 kubectl 的命令模型与配置体系，此设计提供一致的运维体验，增强跨环境操作便利性，同时保持内部实现对现有 Yuants 基础能力的最大复用，便于后续按需扩展新资源或高级命令。
