# Node Unit 日志轮转设计

## 背景

Node Unit 通过 `spawnChild` 将部署任务的 `stdout/stderr` 统一写入 `WORKSPACE_DIR/logs/<deployment_id>.log`，每次部署启动前仅将旧文件重命名为 `.prev.log`。在长时间运行、输出量较大的场景中，单个日志文件可能不断膨胀，占用大量磁盘空间，无法满足“不会把节点磁盘写满”的运维目标。我们计划引入与 kubelet/containerd 类似的按大小和文件数的日志轮转策略。

## 现状与问题

- **无限增长**：单个任务的日志没有体积上限，仅在任务重启时才有一次性轮转。
- **缺乏策略配置**：当前无法针对节点能力调整日志上限或保留份数。
- **读取接口一致性风险**：需要确保 `Deployment/ReadLogSlice` 与实时日志通道兼容新的轮转方式。

## 设计目标

1. 为每个部署日志设置“单文件体积 × 保留文件数”的硬上限，默认与 kubelet 保持一致（10 MiB × 5）。
2. 轮转过程对运行中的子进程透明，写入不中断。
3. 保持现有读取能力可用，必要时补充能力访问历史日志片段。
4. 提供可配置的策略参数，便于按节点磁盘情况调优。

## 轮转策略

- **命名规则**：当前活跃文件保持 `${deployment_id}.log`；最近一次轮转得到的历史文件固定保留未压缩的 `${deployment_id}.log.1`，再之前的历史文件按序号使用 gzip 压缩（`.log.2.gz`、`.log.3.gz` …）。若关闭压缩，则全部保留为 `.log.N`。
- **触发条件**：活跃日志写入前检测累计字节数，若超过 `maxSizeBytes`，先执行轮转再写入当前 chunk。
- **保留数量**：轮转时将现有历史文件序号整体加一，超出 `maxFiles - 1` 的最旧文件删除。
- **异常处理**：轮转过程中若重命名失败，记录错误并继续写入当前文件，避免影响子进程运行，同时将失败信息写入自身日志。

## 实现方案

### 1. 日志写入抽象

- 新增 `RotatingLogStream` 类，封装以下能力：
  - 在构造时接受基础路径（不含扩展名）、轮转策略、共享锁（避免 stdout/stderr 双流竞争）。
  - 初始化时 `stat` 现有活跃文件，评估当前大小，并在超过 `maxSizeBytes` 时立即轮转。
  - 提供 `write(chunk: Buffer | string)` 接口。每次写入：
    1. 将 chunk 转换为 Buffer，计算即将写入后的大小。
    2. 若超限，则执行轮转，再写入。
    3. 写入成功后更新已写字节数。
  - 支持 `close()`，在子进程退出时关闭底层写入流。
  - 若启用压缩，在轮转后将上一轮的 `.log.1` 交给后台任务 gzip，输出为 `.log.2.gz` 并删除未压缩文件。
  - 始终保留最新历史文件 `.log.1` 为未压缩文本，便于快速排障；更旧的历史文件通过后台压缩生成 `.log.N.gz`。
- 通过实现一个兼容 Node.js `Writable` 接口的 `RotatingLogStream`，让 `spawnChild` 可以在保留 `stdoutFilename`/`stderrFilename` 参数的同时，额外接受 `streamFactory` 可选项；当提供工厂函数时基于实际 filename 构造自定义流（同名文件仅创建一次并复用），否则回退到原有按文件名创建写入器。

```ts
class RotatingLogStream extends Writable {
  constructor(basePath, options: RotatingOptions) {
    super({ decodeStrings: false }); // 由我们负责转为 Buffer
    this.basePath = basePath;
    this.opts = options;
    this.currentSize = 0;
    this.pendingCallbacks = [];
  }

  async _construct(callback) {
    try {
      await this.openNewFile({ append: true });
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async _write(chunk, _encoding, callback) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.pendingCallbacks.push(callback);
    await this.enqueueWrite(buf);
  }

  async enqueueWrite(buf) {
    await this.writeQueue.wait(async () => {
      if (this.currentSize + buf.length > this.opts.maxSizeBytes) {
        await this.rotate();
      }
      await this.activeHandle.write(buf);
      this.currentSize += buf.length;
      this.flushCallbacks(); // 轮到当前 chunk 对应的 callback
    });
  }

  flushCallbacks(err) {
    const cb = this.pendingCallbacks.shift();
    if (cb) cb(err);
  }

  async rotate() {
    await this.closeActiveHandle();
    await this.rollCompressedFiles(); // 处理 .log.2.gz 之后的序号
    if (this.opts.compress && (await fileExists(this.plainArchivePath(1)))) {
      const pending = `${this.plainArchivePath(1)}.pending`;
      await rename(this.plainArchivePath(1), pending);
      this.scheduleCompression(pending, this.archivePath(2));
    }
    if (await fileExists(this.activePath())) {
      await rename(this.activePath(), this.plainArchivePath(1));
    }
    await this.openNewFile({ append: false });
    this.currentSize = 0;
  }

  async openNewFile({ append }: { append: boolean }) {
    this.activeHandle = await open(this.activePath(), append ? 'a' : 'w');
  }

  async _final(callback) {
    try {
      await this.closeActiveHandle();
      callback();
    } catch (err) {
      callback(err);
    }
  }

  // 其余辅助方法：activePath / archivePath / closeActiveHandle / scheduleCompression 等同上一节介绍。
}
```

#### 与子进程的解耦

- `spawnChild` 支持两种写入方式：若提供 `streamFactory`，则按需构造 stdout/stderr 的目标流，若两者 filename 相同则复用同一实例；否则沿用 `stdoutFilename`/`stderrFilename` 创建的 `createWriteStream`。
- 子进程退出时，根据是工厂创建的流还是文件流调用 `end()` 或关闭文件句柄；若 stdout/stderr 共用同一个流，避免重复关闭。清理完成后执行可选的 `onExit` 回调。
- `RotatingLogStream` 在轮转窗口内通过内部 `writeQueue` 暂存待写数据，并延后执行 `_write` 的回调，从而为上游实现 backpressure；一旦新文件就绪就刷新缓冲，子进程不会感知到轮转。
- Node 侧 `tail -F` 仍能跟踪新文件；旧文件的压缩与删除在后台异步处理，不影响写入。

### 1.1 `spawnChild` 调整伪代码

```ts
interface SpawnChildOptions {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  cwd?: string;
  stdoutFilename?: string;
  stderrFilename?: string;
  streamFactory?: (filename: string) => Writable | null;
  onExit?: () => void | Promise<void>;
}

export const spawnChild = (ctx: SpawnChildOptions) =>
  new Observable<void>((sub) => {
    const child = spawn(ctx.command, ctx.args, { env: ctx.env, cwd: ctx.cwd, stdio: 'pipe' });

    const stdoutFromFactory =
      ctx.stdoutFilename && ctx.streamFactory ? ctx.streamFactory(ctx.stdoutFilename) : null;
    const stdoutWriter =
      stdoutFromFactory ??
      (ctx.stdoutFilename && createWriteStream(ctx.stdoutFilename, { flags: 'a' })) ??
      process.stdout;

    const stderrFromFactory =
      ctx.stderrFilename === ctx.stdoutFilename
        ? stdoutFromFactory
        : ctx.stderrFilename && ctx.streamFactory
        ? ctx.streamFactory(ctx.stderrFilename)
        : null;
    const stderrWriter =
      stderrFromFactory ??
      (ctx.stderrFilename && ctx.stderrFilename !== ctx.stdoutFilename
        ? createWriteStream(ctx.stderrFilename, { flags: 'a' })
        : stdoutWriter);

    child.stdout?.pipe(stdoutWriter, { end: false });
    child.stderr?.pipe(stderrWriter, { end: false });

    child.once('spawn', () => sub.next());
    child.once('error', (err) => sub.error(err));
    child.once('exit', () => {
      // 仅在我们创建的 writer 上调用 end/close，避免影响共享流
      if (!stdoutFromFactory && ctx.stdoutFilename) stdoutWriter.end?.();
      if (!stderrFromFactory && ctx.stderrFilename && stderrWriter !== stdoutWriter) {
        stderrWriter.end?.();
      }
      stdoutFromFactory?.end?.();
      if (stderrFromFactory && stderrFromFactory !== stdoutFromFactory) {
        stderrFromFactory.end?.();
      }
      Promise.resolve(ctx.onExit?.()).finally(() => sub.complete());
    });

    return () => treeKill(child.pid!, 'SIGKILL');
  });
```

### 2. 轮转流程

1. **准备阶段**：按照序号逆序遍历，将已有的压缩历史文件 `.log.(n).gz` 重命名为 `.log.(n+1).gz`，从 `maxFiles - 1` 限制开始，超出上限直接删除。
2. **处理上一轮 `.log.1`**：若启用了压缩并存在未压缩的 `.log.1`，先将其安全重命名为临时文件（如 `.log.1.pending`），再异步压缩为 `.log.2.gz`。压缩成功后删除源文件；若失败则将其重命名为 `.log.2.raw`（或带 `.failed` 后缀）并记录告警，确保日志仍可追溯。此操作在步骤 1 之后进行，以确保目标位置空闲。
3. **切换当前日志**：关闭现有写流并将 `${deployment_id}.log` 重命名为新的 `.log.1`（保持未压缩，便于人工快速查看最近日志），随后立即以 `flags: 'w'` 打开全新的 `${deployment_id}.log` 等待后续写入。
4. **通知机制**：子进程本身仍写入其 stdout/stderr。`RotatingLogStream` 在轮转期间短暂持有锁阻塞写入，待新文件创建完毕后恢复写入，因此对子进程透明。`tail -F` 将跟随新文件，保持实时日志输出。

### 3. 入口 (`index.ts`) 修改要点

```ts
// 在入口顶部读取日志轮转配置
const logRotateConfig = {
  maxSizeBytes: parseByteSize(process.env.NODE_UNIT_LOG_MAX_SIZE ?? '10Mi'),
  maxFiles: Number(process.env.NODE_UNIT_LOG_MAX_FILES ?? '5'),
  compress: process.env.NODE_UNIT_LOG_ROTATE_COMPRESS !== 'false',
};

const createRotatingStream = memoize((deploymentId: string) => {
  const basePath = join(WORKSPACE_DIR, 'logs', deploymentId);
  return new RotatingLogStream(basePath, logRotateConfig);
});

const runDeployment = (...) => {
  ...
  const logStream = createRotatingStream(deployment.id);

  return spawnChild({
    ...
    streamFactory: () => logStream,     // 新增字段；若缺省则 spawnChild 走 filename 路径
    onExit: async () => {
      // 若一个 deployment 的生命周期结束，可选择在这里调用 logStream.end()
      // 或等待下一次启动复用（需在 RotatingLogStream 内部支持重置）
    },
  });
};

// 在 Deployment/ReadLogSlice 服务中，读取 .log/.log.1/.log.N.gz 的逻辑保持不变；
// 若需要支持 .gz 解压，增加一个 helper readRotatedLog(deploymentId, fileIndex)。
```

> 说明：
>
> - 如果我们希望每次重启部署重新创建 `RotatingLogStream`，可以在 `runDeployment` 中使用 `new` 而非缓存，并在 `finalize` 中调用 `end()`；上面示例采用缓存，提高尾随读取连续性。
> - `parseByteSize`/`memoize` 为内部工具函数，可放在 `const.ts` 或新建 `log.ts`。
> - 入口的其他逻辑（数据库、终端注册等）无需调整，仅在创建子进程时切换到新 stream。

### 3. 日志读取适配

- **`Deployment/ReadLogSlice`**：默认行为保持读取 `.log`，新增可选参数 `file_index`（0 表示当前，1..N 表示历史）。若调用方未升级，可继续读当前文件；若需要回看历史，则显示传入 `file_index`。
- 若历史文件为 `.gz`，在读取时通过流式解压（例如 `createGunzip`）后再截取所需字节，保持接口语义不变。
- **实时日志**：`tail -F` 支持文件重建，现有实现无需调整。需要确保在轮转瞬间新文件立即创建，避免短暂缺失。

### 4. 配置与默认值

- 新增环境变量（可写入配置文件）：
  - `NODE_UNIT_LOG_MAX_SIZE`：单文件最大体积，支持诸如 `10Mi`, `20M`, `10485760` 的写法，默认 `10Mi`.
  - `NODE_UNIT_LOG_MAX_FILES`：保留文件总数，默认 `5`（包含当前文件）。
  - `NODE_UNIT_LOG_ROTATE_COMPRESS`：是否压缩历史文件（默认 `true`，与 kubelet 一样对历史日志使用 gzip）。
- 解析逻辑统一放在 `const.ts` 或新的 `config/log.ts` 中，供 `RotatingLogStream` 和 API 使用。

## 测试计划

1. **单元测试**：为 `RotatingLogStream` 编写测试，覆盖以下场景：
   - 初始文件存在且超过上限时自动轮转。
   - 写入跨越阈值触发轮转，并验证历史文件链条与删除行为。
   - 并发写（stdout/stderr）保持顺序无数据丢失。
   - 重复打开（多次 spawn）共享已有历史文件不冲突。
2. **集成测试**：通过 `spawnChild` 启动伪子进程持续输出，验证：
   - 实际日志大小受限。
   - `Deployment/ReadLogSlice` 能够读取不同 `file_index`。
   - 实时日志在轮转后依旧连续。
3. **边界测试**：模拟重命名失败（例如占用文件），确认错误处理逻辑不影响进程，且留下告警。

## 实施步骤

1. 引入日志轮转配置解析，并在 `const.ts` 中暴露。
2. 实现 `RotatingLogStream`，替换 `spawnChild` 中直接使用 `createWriteStream` 的逻辑。
3. 调整 `runDeployment` 入口，不再手动重命名 `.prev.log`，改为在 Rotator 初始化时处理。
4. 扩展 `Deployment/ReadLogSlice` 请求 schema 与实现，支持历史文件索引。
5. 更新 README 与新文档，说明默认策略与调整方式。
6. 编写/更新测试用例，确保 CI 覆盖。

## 风险与缓解

- **跨平台兼容**：Windows 上的文件锁语义可能与 Linux 不同，需验证。若出现重命名失败，可在 Rotator 中降级为延迟重试。
- **性能影响**：轮转时的同步重命名可能在高并发节点上造成短暂阻塞；通过限制文件数与使用异步 API 减少影响。
- **历史日志访问变化**：新参数导致旧客户端可能报错，需保持参数可选且提供默认值，确保向后兼容。

## 后续展望

- 可选开启历史日志压缩，减少存储占用。
- 根据节点磁盘压力指标动态调整上限（与调度器集成）。
- 将轮转事件上报到监控系统，方便运维观测。
