# Specification: Testing

## 1. 单元测试

由于主要逻辑是胶水代码，单元测试主要覆盖配置读取逻辑（如果有复杂的配置解析）。
对于本期简单需求，可以跳过复杂的单元测试，依赖集成测试。

## 2. 集成测试

- **场景**: 启动 Host，启动 app-http-proxy，验证服务是否注册。
- **步骤**:
  1. 启动 mock Host 或真实 Host。
  2. 运行 `app-http-proxy`。
  3. 检查 Host 的服务注册信息是否存在 `HTTPProxy`：
     - 观察 Host 侧日志或通过管理接口查询 serviceInfo。
  4. (可选) 通过 Client Terminal 发送请求验证连通性。

## 3. 手动验证

- 运行 `pnpm start`，观察 Host 侧日志或管理接口确认服务注册。
- 如需避免外部请求，可手动设置 `PROXY_IP`。
