下面把 Gate API v4 里的 **EarnUni（余币宝理财）** 相关接口，整理成一份可直接复制使用的 **Markdown**（按接口分节 + 参数/返回表格）。

> REST BaseURL（实盘 / 测试网 / 合约备用）见文档“访问链接”一节。([Gate.com][1])

---

# EarnUni（余币宝理财）API（Gate API v4）

## Base URL

- 实盘：`https://api.gateio.ws/api/v4` ([Gate.com][1])
- 测试网：`https://api-testnet.gateapi.io/api/v4` ([Gate.com][1])

> 下文的 Path 都是 **`/api/v4` 后面的部分**（例如 `/earn/uni/currencies`）。([Gate.com][1])

---

## 接口速览

| 功能                         | Method | Path                                   | 鉴权               |
| ---------------------------- | -----: | -------------------------------------- | ------------------ |
| 查询理财币种列表             |    GET | `/earn/uni/currencies`                 | 否 ([Gate.com][1]) |
| 查询单个理财币种详情         |    GET | `/earn/uni/currencies/{currency}`      | 否 ([Gate.com][1]) |
| 创建理财 / 赎回              |   POST | `/earn/uni/lends`                      | 是 ([Gate.com][1]) |
| 查询用户币种理财列表         |    GET | `/earn/uni/lends`                      | 是 ([Gate.com][1]) |
| 修改用户理财信息（min_rate） |  PATCH | `/earn/uni/lends`                      | 是 ([Gate.com][1]) |
| 查询理财流水记录             |    GET | `/earn/uni/lend_records`               | 是 ([Gate.com][1]) |
| 查询用户单币种总利息收益     |    GET | `/earn/uni/interests/{currency}`       | 是 ([Gate.com][1]) |
| 查询用户派息记录             |    GET | `/earn/uni/interest_records`           | 是 ([Gate.com][1]) |
| 查询币种利息复利状态         |    GET | `/earn/uni/interest_status/{currency}` | 是 ([Gate.com][1]) |
| 余币宝币种年化走势图         |    GET | `/earn/uni/chart`                      | 是 ([Gate.com][1]) |
| 币种预估年化利率             |    GET | `/earn/uni/rate`                       | 是 ([Gate.com][1]) |

---

# 1) 查询理财币种列表

**GET** `/earn/uni/currencies` ([Gate.com][1])

- 描述：查询可参与余币宝的币种列表 ([Gate.com][1])
- 鉴权：不需要 ([Gate.com][1])

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段              | 类型   | 说明                                          |
| ----------------- | ------ | --------------------------------------------- |
| `currency`        | string | 币种名称 ([Gate.com][1])                      |
| `min_lend_amount` | string | 最小借出数量（单位：该币种）([Gate.com][1])   |
| `max_lend_amount` | string | 累计最大借出数量（单位：USDT）([Gate.com][1]) |
| `max_rate`        | string | 最大利率（小时）([Gate.com][1])               |
| `min_rate`        | string | 最小利率（小时）([Gate.com][1])               |

---

# 2) 查询单个理财币种详情

**GET** `/earn/uni/currencies/{currency}` ([Gate.com][1])

- 鉴权：不需要 ([Gate.com][1])

## Path 参数

| 名称       | 类型   | 必选 | 说明                 |
| ---------- | ------ | ---: | -------------------- |
| `currency` | string |   是 | 币种 ([Gate.com][1]) |

## 返回（200）

返回对象字段同“查询理财币种列表”的单项：([Gate.com][1])

`currency / min_lend_amount / max_lend_amount / max_rate / min_rate` ([Gate.com][1])

---

# 3) 创建理财或赎回

**POST** `/earn/uni/lends` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])
- 语义要点（文档原意整理）：

  - **lend**：需要设置最低利率 `min_rate`，平台在整点判定借出是否成功；收益按判定利率计算并按小时结算；如果利率设置过高导致当小时借出失败，则当小时无利息；整点判定前赎回也可能导致当小时无利息。([Gate.com][1])
  - **redeem**：借出失败部分可较快到账；借出成功部分赎回通常在下个整点到账；整点前后有结算窗口会限制操作。([Gate.com][1])

## Body 参数

| 字段       | 类型   | 必选 | 说明                                                                       |
| ---------- | ------ | ---: | -------------------------------------------------------------------------- |
| `currency` | string |   是 | 币种名称 ([Gate.com][1])                                                   |
| `amount`   | string |   是 | 投入理财池数量 ([Gate.com][1])                                             |
| `type`     | string |   是 | `lend`（借出）/ `redeem`（赎回）([Gate.com][1])                            |
| `min_rate` | string |   否 | 最小利率；**借出时要求提供**，过高可能导致借出失败且无利息 ([Gate.com][1]) |

## 返回

- `204 No Content`：操作成功 ([Gate.com][1])

---

# 4) 查询用户币种理财列表

**GET** `/earn/uni/lends` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Query 参数

| 名称       | 类型   | 必选 | 说明                                            |
| ---------- | ------ | ---: | ----------------------------------------------- |
| `currency` | string |   否 | 指定币种过滤 ([Gate.com][1])                    |
| `page`     | int    |   否 | 页码 ([Gate.com][1])                            |
| `limit`    | int    |   否 | 每页数量（默认 100，范围 1~100）([Gate.com][1]) |

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段                   | 类型   | 说明                                  |
| ---------------------- | ------ | ------------------------------------- |
| `currency`             | string | 币种 ([Gate.com][1])                  |
| `current_amount`       | string | 本次理财数量 ([Gate.com][1])          |
| `amount`               | string | 理财总数量 ([Gate.com][1])            |
| `lent_amount`          | string | 已借出数量 ([Gate.com][1])            |
| `frozen_amount`        | string | 已申请赎回未到账数量 ([Gate.com][1])  |
| `min_rate`             | string | 最小利率 ([Gate.com][1])              |
| `interest_status`      | string | 利息状态：派息 / 复投 ([Gate.com][1]) |
| `reinvest_left_amount` | string | 未复投金额 ([Gate.com][1])            |
| `create_time`          | int64  | 创建时间 ([Gate.com][1])              |
| `update_time`          | int64  | 最新修改时间 ([Gate.com][1])          |

---

# 5) 修改用户理财信息（min_rate）

**PATCH** `/earn/uni/lends` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])
- 说明：目前仅支持修改最小利率（小时）([Gate.com][1])

## Body 参数

| 字段       | 类型   | 必选 | 说明                     |
| ---------- | ------ | ---: | ------------------------ |
| `currency` | string |   否 | 币种名称 ([Gate.com][1]) |
| `min_rate` | string |   否 | 最小利率 ([Gate.com][1]) |

## 返回

- `204 No Content`：修改成功 ([Gate.com][1])

---

# 6) 查询理财的流水记录

**GET** `/earn/uni/lend_records` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Query 参数

| 名称       | 类型   | 必选 | 说明                                            |
| ---------- | ------ | ---: | ----------------------------------------------- |
| `currency` | string |   否 | 指定币种过滤 ([Gate.com][1])                    |
| `page`     | int    |   否 | 页码 ([Gate.com][1])                            |
| `limit`    | int    |   否 | 每页数量（默认 100，范围 1~100）([Gate.com][1]) |
| `from`     | int64  |   否 | 起始时间戳（Unix）([Gate.com][1])               |
| `to`       | int64  |   否 | 终止时间戳（Unix）([Gate.com][1])               |
| `type`     | string |   否 | `lend` / `redeem` ([Gate.com][1])               |

> `type` 枚举值：`lend`、`redeem`。([Gate.com][1])

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段                 | 类型   | 说明                                        |
| -------------------- | ------ | ------------------------------------------- |
| `currency`           | string | 币种名称 ([Gate.com][1])                    |
| `amount`             | string | 本次借出/赎回数量 ([Gate.com][1])           |
| `last_wallet_amount` | string | 该记录之前待理财数量 ([Gate.com][1])        |
| `last_lent_amount`   | string | 该记录之前已借出数量 ([Gate.com][1])        |
| `last_frozen_amount` | string | 该记录之前已冻结待赎回数量 ([Gate.com][1])  |
| `type`               | string | 记录类型：`lend` / `redeem` ([Gate.com][1]) |
| `create_time`        | int64  | 创建时间戳 ([Gate.com][1])                  |

---

# 7) 查询用户单币种总利息收益

**GET** `/earn/uni/interests/{currency}` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Path 参数

| 名称       | 类型   | 必选 | 说明                 |
| ---------- | ------ | ---: | -------------------- |
| `currency` | string |   是 | 币种 ([Gate.com][1]) |

## 返回（200）

| 字段       | 类型   | 说明                     |
| ---------- | ------ | ------------------------ |
| `currency` | string | 币种 ([Gate.com][1])     |
| `interest` | string | 利息收益 ([Gate.com][1]) |

---

# 8) 查询用户派息记录

**GET** `/earn/uni/interest_records` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Query 参数

| 名称       | 类型   | 必选 | 说明                                            |
| ---------- | ------ | ---: | ----------------------------------------------- |
| `currency` | string |   否 | 指定币种过滤 ([Gate.com][1])                    |
| `page`     | int    |   否 | 页码 ([Gate.com][1])                            |
| `limit`    | int    |   否 | 每页数量（默认 100，范围 1~100）([Gate.com][1]) |
| `from`     | int64  |   否 | 起始时间戳（Unix）([Gate.com][1])               |
| `to`       | int64  |   否 | 终止时间戳（Unix）([Gate.com][1])               |

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段              | 类型   | 说明                                     |
| ----------------- | ------ | ---------------------------------------- |
| `status`          | int    | 状态：`0` 失败，`1` 成功 ([Gate.com][1]) |
| `currency`        | string | 币种 ([Gate.com][1])                     |
| `actual_rate`     | string | 真实利率 ([Gate.com][1])                 |
| `interest`        | string | 利息 ([Gate.com][1])                     |
| `interest_status` | string | 派息 / 复投 ([Gate.com][1])              |
| `create_time`     | int64  | 创建时间戳 ([Gate.com][1])               |

---

# 9) 查询币种利息复利状态

**GET** `/earn/uni/interest_status/{currency}` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Path 参数

| 名称       | 类型   | 必选 | 说明                 |
| ---------- | ------ | ---: | -------------------- |
| `currency` | string |   是 | 币种 ([Gate.com][1]) |

## 返回（200）

| 字段              | 类型   | 说明                                                                            |
| ----------------- | ------ | ------------------------------------------------------------------------------- |
| `currency`        | string | 币种 ([Gate.com][1])                                                            |
| `interest_status` | string | `interest_dividend`（正常派息）/ `interest_reinvest`（利息复投）([Gate.com][1]) |

---

# 10) 余币宝币种年化走势图

**GET** `/earn/uni/chart` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## Query 参数

| 名称    | 类型   | 必选 | 说明                                             |
| ------- | ------ | ---: | ------------------------------------------------ |
| `from`  | int64  |   是 | 开始时间戳（秒），最大跨度 30 天 ([Gate.com][1]) |
| `to`    | int64  |   是 | 结束时间戳（秒），最大跨度 30 天 ([Gate.com][1]) |
| `asset` | string |   是 | 币种名称 ([Gate.com][1])                         |

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段    | 类型   | 说明                                |
| ------- | ------ | ----------------------------------- |
| `time`  | int64  | 时间戳 ([Gate.com][1])              |
| `value` | string | 数值（年化相关数值）([Gate.com][1]) |

---

# 11) 币种预估年化利率

**GET** `/earn/uni/rate` ([Gate.com][1])

- 鉴权：需要 API key + secret ([Gate.com][1])

## 返回（200）

返回数组，每项字段：([Gate.com][1])

| 字段       | 类型   | 说明                                                      |
| ---------- | ------ | --------------------------------------------------------- |
| `currency` | string | 币种 ([Gate.com][1])                                      |
| `est_rate` | string | 预估年化利率；例如 `0.8014` 表示约 80.14% ([Gate.com][1]) |

---

如果你希望我把这份 Markdown **拆成你项目里的文件结构**（比如 `docs/gate/earnuni.md`），或者顺便给你生成 **TypeScript 接口定义 + 请求封装（含签名/重试/限频）**，我也可以直接按你现有风格（fetch/axios、zod、ts-rest、openapi-generator 等）给一版。

[1]: https://www.gate.com/docs/developers/apiv4/zh_CN/ 'Gate API | Gate API v4'
