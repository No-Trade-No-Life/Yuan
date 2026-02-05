## What

为 http-services 增加 async proxy ip 选择与 terminalInfos$ 就绪等待，超时固定 30s，并将 vendor 调用点改为 await。

## Why

启动阶段 terminalInfos$ 未就绪时，同步 round-robin 会出现空池并抛错；async 等待可消除该类启动失败。

## How

- 新增 async helper 等待 terminalInfos$ 首发后选择 proxy ip。
- 超时固定 30_000ms，错误契约保持一致。
- vendor 调用点改为 await 版本。

## Testing

- `(cd libraries/http-services && rushx build)`

## Risk / Rollback

- Risk: 启动阶段可能等待最长 30s；无代理配置场景需关注启动延迟。
- Rollback: 回退 async helper 与 vendor await 调用，恢复同步选择。
- Review: code/security PASS。

## Links

- RFC: `.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md`
- Walkthrough: `.legion/tasks/http-services-terminalinfos-ready/docs/walkthrough.md`
- Review Code: `.legion/tasks/http-services-terminalinfos-ready/docs/review-code.md`
- Review Security: `.legion/tasks/http-services-terminalinfos-ready/docs/review-security.md`
