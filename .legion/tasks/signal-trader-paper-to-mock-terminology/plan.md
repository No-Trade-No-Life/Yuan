# signal-trader-paper-to-mock-terminology

## 目标

把 signal-trader 中用户可见的 paper 模式术语统一改为 mock，同时保持底层协议与运行语义兼容。

## 要点

- 只改用户可见术语，不轻易改底层协议字段和值
- 前端、脚本、文档、日志/提示语中 visible 的 paper 文案统一切成 mock
- 保持现有 paper stack、execution_mode、service 名称兼容，避免破坏代码链路
- 补构建/测试与 PR 文档

## 范围

- .legion/tasks/signal-trader-paper-to-mock-terminology/\*\*
- ui/signal-trader-web/\*\*
- apps/signal-trader/\*\*
- .legion/playbook.md

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-24 | 最后更新: 2026-03-24_
