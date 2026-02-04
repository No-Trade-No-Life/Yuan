# RFC 对抗审查报告: TokenBucket Proxy IP Key

目标文档: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
审查日期: 2026-02-04
原则: 奥卡姆剃刀（质疑必要性、假设、边界、复杂度）

## 结论概述

本次聚焦“error_code 归属表”闭环与阶段归属一致性。`E_PUBLIC_IP_MISSING` 已从错误码集合移除并降级为直连场景日志/指标，error_code 边界与阶段归属已封闭；归属表覆盖 `resolveHTTPProxyTarget` 与发送阶段全部错误码。当前无阻塞。

## 必须修正

（无）

## 可选优化

1. 明确 `E_PROXY_REQUEST_FAILED` 的边界与归一化口径

- 质疑: 该错误码仅在“发送阶段才可能产生”，但未说明由哪个层面归一化网络错误（http-services 还是 vendor）。
- 最小修改建议: 在“错误码归属”或接口注记中补一句“仅由 `fetchViaHTTPProxyTarget` 统一映射产生，resolve 阶段不得返回该码”，避免实现重复映射或遗漏。

2. 将“候选枚举 MUST”提升到 Behavior Requirements

- 质疑: 枚举 MUST 目前在接口注记中，可能被忽略而落回单 target 解析，破坏 no_service/no_match 区分。
- 最小修改建议: 在 R20/R21 后追加一句“候选枚举 MUST 基于 `resolveTargetServicesSync`（或等价接口）”。

## 可实现性/可验证性/可回滚性检查

- 可实现性: error_code 归属表覆盖完整，resolve 枚举前提已说明。
- 可验证性: 归属表闭环，测试可覆盖 resolve/发送阶段边界与错误映射。
- 可回滚性: 无新增开关，仅代码回退即可。

## 阻塞判断

无阻塞。
