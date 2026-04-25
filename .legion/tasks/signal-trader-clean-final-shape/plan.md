# signal-trader-clean-final-shape

## 目标

删除 signal-trader 中已废弃或仅为兼容保留的代码与文件，只保留当前最终正确形态，并交付完整 Legion 文档。

## 要点

- 删除 `ui/web` 废弃 SignalTrader 前端与相关导出/文案
- 删除仅为兼容保留的 paper/mock wrapper，收敛到单一正式入口
- 更新剩余脚本、测试、文档到最终命名
- 通过构建/测试确认 cleanup 不破坏当前正式链路

## 范围

- .legion/tasks/signal-trader-clean-final-shape/\*\*
- ui/web/\*\*
- ui/signal-trader-web/\*\*
- apps/signal-trader/\*\*
- docs/zh-Hans/packages/@yuants-ui-web.md
- .legion/playbook.md

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-24 | 最后更新: 2026-03-24_
