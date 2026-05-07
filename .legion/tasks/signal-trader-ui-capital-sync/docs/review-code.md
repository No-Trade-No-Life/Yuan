# signal-trader-ui-capital-sync 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. 前端已经真实接上后端新增资本能力：`capital` 四层资金、`investor` / `signal` 聚合、formal quote、internal netting、`profit_target_reached` advisory、`reference_price_missing`、reconciliation `difference/tolerance/explanation` 都有明确读取和页面落点。
2. 原始证据面不再只是摘要列表；现在事件与审计都能在同页核对收敛后的证据内容，同时避免了上一版那种整对象裸透传。
3. projection 读取改成逐项容错，不再因为新增 query 某一项失败就把整组 capital 视图一起拖垮。
4. `SubmitSignal` 仍只发送用户输入字段，没有把 `reference_price*` 带回前端写链，和后端正式价格边界一致。

## Nits

1. Playwright 仍主要覆盖“模块可见 + 基础提交”，对 capital / investor / signal / quote / reconciliation 的字段值断言还不够强。
2. `sanitize*` 当前已经比整对象裸展示安全很多，但后续若后端新增复杂 `detail` 结构，仍建议继续按 allowlist 收紧。
3. 页面信息密度已经明显提升，后续若继续扩资本能力，最好再考虑更明确的分组或折叠层次，避免读面再次膨胀。
