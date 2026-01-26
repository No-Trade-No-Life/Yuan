# app-asg-eventbridge-notifier

## 目标

新增一个用于 ASG 终止事件告警的应用（参考 `apps/feishu-notifier` 的工程结构），以长期运行的 Node app 方式接收 EventBridge 的 Auto Scaling 事件并按规则推送到 Feishu，支持仅在 `status checks failure` 场景触发。

## 要点

- 新增应用目录 `apps/asg-eventbridge-notifier`，遵循现有 app 的 package/tsconfig/rig 结构。
- 解析 EventBridge 事件（`source=aws.autoscaling`、终止类 `detail-type`），过滤 ASG 名称并可选基于 `detail.Cause` 进行二次过滤。
- 告警消息包含 ASG 名称、实例 ID、终止结果、Cause、Region、AccountId、LifecycleHook，并显示 UTC 与 JST 时间（参考用户时区提示）。
- 告警目标固定为 Feishu：通过 `Feishu/SendMessage` 服务发送，消息卡片结构参考 `apps/alert-receiver`，不新增额外配置项。

## 范围

- `apps/asg-eventbridge-notifier/**`（新增）
- `rush.json`（注册新 app）
- 其他必要的配置文件（`tsconfig.json` / `config/*`）

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **实现** - 1 个任务
4. **验证** - 1 个任务

---

## 设计方案

### 核心流程

1. 接收 EventBridge 事件（JSON）：`source`、`detail-type`、`detail`。
2. 校验事件类型与 ASG 名称：仅处理 `EC2 Instance Terminate Successful/Unsuccessful` + 指定 `AutoScalingGroupName`。
3. 可选过滤：若开启 `STATUS_CHECKS_ONLY`，要求 `detail.Cause` 含 `status checks failure`。
4. 格式化告警消息：展示 ASG/实例/状态/Cause，时间字段同时输出 UTC 与 JST。
5. 通过 `Terminal` 调用 `Feishu/SendMessage` 推送到 `apps/feishu-notifier`。

> [REVIEW] 这个设计最后输出要直接发到 feishu-notifier，配置飞书卡片参考 alert-receiver，不要配置。
>
> [RESPONSE] 已修改设计：目标固定通过 `Feishu/SendMessage` 发往 `apps/feishu-notifier`，并注明消息卡片结构参考 `apps/alert-receiver`，不新增额外配置项。核心流程与要点同步调整。
> [STATUS:resolved]

### 支持的 detail-type

- `EC2 Instance Terminate Successful`
- `EC2 Instance Terminate Unsuccessful`

### 接口与配置草案

- 运行模式：长期运行的 Node app（不提供 Lambda handler）。
- 事件处理入口：`handleAsgEvent(event)`，返回 `{ notified: boolean; reason?: string }`。
- 环境变量（拟）：
  - `ASG_NAMES`（分号分隔）
  - `STATUS_CHECKS_ONLY`（true/false）
  - `FEISHU_RECEIVER_ID`（发送对象，用户/群组 id）

### 消息格式草案

- 标题：`ASG Terminate {Successful|Unsuccessful}`
- 内容字段：
  - `AutoScalingGroupName`
  - `EC2InstanceId`
  - `Cause`（原文保留）
  - `Region`
  - `AccountId`
  - `LifecycleHookName`
  - `EventTime`（UTC + JST）

### 文件变更明细（预期）

- `apps/asg-eventbridge-notifier/package.json`
- `apps/asg-eventbridge-notifier/src/index.ts`
- `apps/asg-eventbridge-notifier/src/handler.ts`（事件解析 + 过滤 + 路由）
- `apps/asg-eventbridge-notifier/src/format.ts`（消息模板 + 时区转换）
- `apps/asg-eventbridge-notifier/tsconfig.json` / `config/*`
- `rush.json`

### 待确认/不确定点

- 过滤策略：默认是否仅 `status checks failure`，还是允许 `detail-type` 即全部告警？
- `detail.Cause` 字段是否稳定包含 `status checks failure` 字样，需要事件样本确认。

> [REVIEW]
>
> 1. feishu
> 2. 长期运行
> 3. 全部 type 要补充到这个 plan 里让我 review
> 4. 消息里补充 region accountid lifecyclehook
>
> [RESPONSE] 已按要求更新：明确目标为 Feishu、长期运行 Node app；补充支持的 detail-type 列表；消息字段新增 Region/AccountId/LifecycleHook；待确认项收敛到过滤策略与 Cause 样本。
> [STATUS:resolved]

_创建于: 2026-01-13 | 最后更新: 2026-01-13_
