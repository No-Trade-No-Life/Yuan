# signal-trader-paper-to-mock-terminology - 上下文

## 会话进展 (2026-03-24)

### ✅ 已完成

- 已盘点 signal-trader 相关用户可见的 paper 术语，并把兼容边界锁定为“只改展示与人类可见输出，不改 `execution_mode='paper'` 等底层协议值”。
- 已把独立前端、mock stack 脚本、dev bootstrap 与测试标题中的用户可见 paper 文案改为 mock。
- 已验证：`ui/signal-trader-web` build 通过，`npm run test:e2e:mock` 通过，`apps/signal-trader` build 通过。
- 已把独立前端中用户可见的 `paper` profile / runtime mode / E2E 标签改成 `mock`。
- 已新增 mock 入口包装：`run-mock-stack.mjs`、`mock-clock.mjs`、`run-local-mock-stack.sh`、`smoke-mock.sh`、`bootstrap-mock-app.js`。
- 已完成验证：`ui/signal-trader-web` build 通过，`npm run test:e2e:mock` 通过，根目录 `rush build` 通过（仅剩 `vendor-ctp` 的 Node 版本 warning）。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                                 | 原因                                                                                             | 替代方案                                                                           | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------- |
| 术语替换只针对用户可见层：UI 标签、脚本输出、包脚本名、测试标题等统一改为 mock；底层 `execution_mode='paper'`、`paper_simulated`、现有文件名与 runtime id 保持兼容。 | 用户要改的是用词，不是把整个协议值和内部标识做破坏式重命名；后者会放大风险且影响已有链路。       | 直接把底层枚举、文件名和运行时 ID 全改掉；优点是表面更统一，缺点是破坏兼容面太大。 | 2026-03-24 |
| 术语替换继续坚持“用户可见改 mock，底层协议保留 paper 兼容”；同时补 mock wrapper 入口，而不是硬改内部文件名和协议枚举。                                               | 这样既满足用户对用词的要求，又避免破坏 `execution_mode='paper'` / `paper_simulated` 等既有链路。 | 直接全量重命名内部协议值与文件；优点是表面统一，缺点是兼容面和风险过大。           | 2026-03-24 |

---

## 快速交接

**下次继续从这里开始：**

1. (待填写)

**注意事项：**

- (待填写)

---

_最后更新: 2026-03-24 17:20 by Claude_
