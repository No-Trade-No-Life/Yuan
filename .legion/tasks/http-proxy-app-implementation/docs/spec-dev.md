# Specification: Development

## 1. 包定义

- **包名**: `@yuants/app-http-proxy`
- **位置**: `apps/http-proxy`
- **类型**: Application

## 2. 依赖管理

```json
{
  "dependencies": {
    "@yuants/protocol": "workspace:*",
    "@yuants/http-services": "workspace:*",
    "rxjs": "~7.5.6"
  },
  "devDependencies": {
    "@types/node": "24",
    "typescript": "~5.9.3"
  }
}
```

## 3. 核心逻辑 (`src/index.ts`)

1. 读取环境变量：
   - `PROXY_IP`: 代理实例标识（可选，未配置时调用 `http://ifconfig.me/ip` 获取公网 IP）
   - `CONCURRENT`: 并发处理上限（默认: `10`）
   - `INGRESS_TOKEN_CAPACITY`: 入队令牌桶容量（默认: `100`）
   - 其他 Terminal 连接参数由 `Terminal.fromNodeEnv()` 读取（详见 `@yuants/protocol` 文档）
2. 构造 `labels`（仅包含有值字段）：
   - `ip`
3. 创建 `Terminal` 实例：
   - `Terminal.fromNodeEnv()`
4. 调用 `provideHTTPProxyService(terminal, labels, options)`：
   - `options.concurrent = CONCURRENT`
   - `options.ingress_token_capacity = INGRESS_TOKEN_CAPACITY`
5. 处理进程信号 (`SIGINT`, `SIGTERM`) 以优雅退出：
   - 首次信号触发 `dispose()` 与 `terminal.dispose()`
   - 在 RxJS 流中完成清理，并通过 timeout 保障退出

## 3.1 安全边界说明

- 本应用不实现应用层鉴权，依赖 Host 的接入控制与网络隔离。
- 未设置目标 host 级别限制，部署时应结合网络策略与访问控制。
- 默认会访问 `http://ifconfig.me/ip` 获取公网 IP，需确保外部访问策略允许。

## 4. 目录结构

```
apps/http-proxy/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
└── Dockerfile (可选)
```
