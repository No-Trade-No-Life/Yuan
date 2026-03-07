# Task Brief - 实盘交易库 heavy RFC 设计

## 1) 问题定义

基于最新会议共识，重新收敛一版可直接落地的 High-risk 设计：

- 上游信号采用 **push**，V1 只接收离散三值 `-1/0/1`
- 执行层按“以损定仓（VC / 止损参考值）”计算仓位
- 下单阶段必须同步挂止盈/止损，不接受“事后曲线修正”
- 投资者状态独立记录，执行可合仓、归因需拆回投资者维度
- 核心能力以单一 core lib 交付，副作用走 ports/effects 抽象

本轮目标切换为实现里程碑交付：在已通过 RFC 评审的前提下落地 core lib、完成验证与评审，并生成可直接用于 PR 的交付文案。

## 2) 本阶段目标（stage=continue）

- `labels`: `rfc:heavy`, `epic`, `risk:high`, `continue`
- `rfcProfile`: `heavy`
- `stage`: `continue`
- 基于已冻结 RFC 落地 `libraries/live-trading` 单一 core lib（无副作用）
- 产出并更新 `test-report.md` / `review-code.md` / `review-security.md`
- 生成实现阶段 walkthrough 与 `pr-body.md`

## 3) 非目标（本阶段明确不做）

- 不接入真实交易所、不执行真实下单
- 不实现数据库 migration、线上发布和运行时部署
- 不在库内引入 DB/网络/消息/进程副作用

## 4) 输入素材

- 参考图：`meetgraph_7612215548813921240_d41f0630-20a3-44d3-8dfb-79f0a030e21b.png`
- 参考图：`whiteboard_exported_image.png`
- 会议整理稿（已确认结论 + 倾向 + 否决项）：
  - 已拍板：push 输入、`-1/0/1` 三态、下单即挂 TP/SL、投资者分账、审计必备、核心做成可 mock 的 lib
  - 明确否决：不允许预支未来 VC
  - 倾向但待数据验证：止损参考值信号层统一、缓慢注资、最小手与跟单策略

## 5) 风险分级

- `Risk Level`: **High**
- 判定理由：
  - 涉及真实资金风险边界（VC、止损止盈、账户隔离、限流冷却）
  - 设计决定订单生命周期控制与审计追责能力
  - 多投资者归因与资金回流策略错误会放大损失与合规风险

## 6) 验收标准（端到端交付）

- `libraries/live-trading` 核心库实现满足“单一 core lib + 无副作用”边界
- `test-report.md` 包含 `npx heft test --clean` 与 `rush build --to @yuants/live-trading` 结果
- `review-code.md` 与 `review-security.md` 无未关闭 blocking
- `report-walkthrough.md` 与 `pr-body.md` 可直接用于实现阶段 PR

## 7) 默认假设（先做后审）

- V1 信号协议固定为 `signal_key + {-1,0,1}`
- 仓位按 `Position = floor_to_lot(VC / stop_loss_ref_pct)`，且禁止预支未来 VC
- 投资者状态独立，执行合仓、归因拆账
- 风控控制点前置在执行层：下单阶段必须带 TP/SL
- 核心库仅输出决策与 effects，不内置 DB/网络/消息副作用

## 8) Open Questions（RFC 中显式标注 TBD）

- `stop_loss_ref_pct` 使用 `MAX/P99/P95/窗口遗忘` 的最终策略
- 反向信号语义：强制先平后开 vs 原子反手
- 资金回流策略：逐笔回扫 vs 批量回扫
- burst 配额是否启用及恢复参数
- 交易账户常驻最小手余额策略

## 9) 验证计划（本阶段）

- 调用 `engineer` 落地实现
- 运行 `run-tests` 产出 `test-report.md`
- 运行 `review-code` 与 `review-security`，阻塞项闭环
- 运行 `report-walkthrough` 产出 `report-walkthrough.md` + `pr-body.md`
