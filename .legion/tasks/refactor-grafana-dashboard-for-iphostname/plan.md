# Refactor Grafana Dashboard for IP/Hostname

## 目标

重构 Grafana 仪表板为 IP/Hostname 分组，并修改代码确保 Label 注入

## 要点

- 将 RFC 文档翻译为中文
- 修改 server.ts：确保 metrics 包含 ip/hostname 标签
- 移除 Region/Tier 变量，添加 Hostname/IP 变量
- 更新面板以按 IP/Hostname 分组
- 添加新指标：Method, Response Codes, Error Rate by IP

## 范围

- libraries/http-services/grafana-dashboard.json

## 阶段概览

1. **Design** - 1 个任务
2. **Implementation** - 1 个任务
3. **Verification** - 1 个任务

---

_创建于: 2026-01-31 | 最后更新: 2026-01-31_
