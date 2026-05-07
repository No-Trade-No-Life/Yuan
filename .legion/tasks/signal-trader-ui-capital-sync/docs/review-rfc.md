# signal-trader-ui-capital-sync RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review

## 关键结论

1. 主阅读路径已经从“原始 JSON 排障”切到“capital posture -> evidence -> raw 下钻”，方向正确。
2. 前端范围控制合理：未扩到新 API、新写操作或多路由重构，仍保持独立控制台项目形态。
3. 写区 fail-close 边界保留：前端不新增也不信任 `reference_price*`，正式价格证据仍由后端 worker 注入。
4. 主要 nit 是能力映射需要在实现中钉死：capital / investor / signal / formal quote / advisory / reconciliation 都必须有明确 UI 落点，而不能只是“看起来有卡片”。
5. 原始证据面必须保留，但不应变回无差别 JSON 墙；应有收敛后的证据摘要和可核对入口并存。
