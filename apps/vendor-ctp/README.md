# vendor-ctp

该模块负责把 CTP 官方提供的 C 接口包装成我们可以直接在 Node.js 里调用的形态。核心思路是用 CTP SDK 附带的四个头文件作为唯一真实的数据源，然后借助脚本批量生成：

- 类型安全的 TypeScript 枚举与结构体声明，方便在上层业务里构造请求、消费推送；
- C++ 桥接代码，将 `CThostFtdcTraderSpi` 的回调和 `CThostFtdcTraderApi` 的请求转换成 ZeroMQ 与 JSON 协议，从而与 Node 侧进程通讯。

## 目录结构速览

- `ctp/include/ThostFtdcMdApi.h`：行情接口声明，用于生成订阅行情的 `MdBridge`。
- `ctp/include/ThostFtdcTraderApi.h`：交易接口声明，是生成桥接代码的主数据源。
- `ctp/include/ThostFtdcUserApiDataType.h`：枚举和基础类型定义，决定了字段的精度、长度以及取值范围。
- `ctp/include/ThostFtdcUserApiStruct.h`：请求和回包结构体的字段定义。
- `ctp/src/main.cpp`：原生二进制的入口，负责装配 ZMQ 与 CTP，随后调用生成的 `Bridge` 类。
- `src/scripts/*.ts`：代码生成脚本，编译后的版本位于 `lib/scripts`，构建流程直接调用。
- `src/assets/ctp-types.ts`：自动生成的 TypeScript 类型文件。
- `ctp/include/NTNL-CTP-Bridge-Interface.GENERATED.hpp` 与 `ctp/src/NTNL-CTP-Bridge-Implementation.GENERATED.cpp`：自动生成的交易桥接头/源文件。
- `ctp/include/NTNL-CTP-Md-Bridge-Interface.GENERATED.hpp` 与 `ctp/src/NTNL-CTP-Md-Bridge-Implementation.GENERATED.cpp`：自动生成的行情桥接头/源文件。

## 生成流水线概述

生成流程分为三个阶段，全部逻辑都在 `apps/vendor-ctp/src/scripts` 内实现：

1. **元数据抽取（`ctp-meta.ts`）**

   - 使用 RxJS 对头文件逐行流式处理，按照 CTP 头文件中惯用的 `///` 注释块和 `#define` 语句切分段落。
   - `makeDataTypeMeta` 解析 `typedef` 与前置枚举，得到字段长度、原始 C 类型、可选枚举值等信息。
   - `makeStructMeta` 解析结构体声明，保留字段顺序与注释描述，后续可以直接映射。
   - 抽取出的元数据会被后续两个生成器共享，确保所有语言层面的定义保持一致。

2. **TypeScript 类型生成（`build-ctp-types.ts`）**

   - 以元数据为基础生成 `src/assets/ctp-types.ts`。
   - 如果某个字段有离散枚举值，就会生成 `export enum ...`；否则直接转换为 `number` / `string` / `boolean` 等基础类型。
   - 对每个结构体生成 `export interface I<StructName>`，字段注释直接继承自头文件，既是文档又能在 IDE 中提示。
   - 上层业务通过 `import { I<CtpStruct> } from '@yuants/vendor-ctp/...'` 即可获得静态类型保障。

3. **C++ 桥接生成（`build-ctp-bridge.ts`）**

   - 遍历 `CThostFtdcTraderSpi` 的所有虚函数，生成交易侧 `Bridge` 的回调实现，统一把回调结果打包成 JSON：
     - 失败时附带错误码和经过 `iconv`（GBK⇄UTF-8）转换后的错误信息；
     - 成功时将结构体内容序列化成 JSON（同样自动处理编码与数组长度）。
   - 遍历 `CThostFtdcTraderApi` 的请求函数，生成 `Bridge::ListenReq` 中的大型 `if-else` 路由，按方法名反射调用对应的 API。
   - 并行遍历 `CThostFtdcMdSpi` / `CThostFtdcMdApi`，生成行情侧 `MdBridge`，负责推送 `Md_On*` 事件与处理 `Subscribe/UnSubscribe` 请求。
   - 同步生成 `to_json` / `from_json` 函数，让 nlohmann/json 可以直接在结构体与 JSON 之间互转，从而复用请求与回调的编码逻辑。
   - 最后输出 `Bridge::Serve`，在新线程中启动请求监听循环，并维护到 Node 进程的 ZeroMQ push/pull 通道。

生成出来的 `Bridge` 类在运行时承担两个职责：

- **推送方向**：所有 `OnXXX` 回调统一打包成 `{ request_id, res }` 结构，通过 `push_sock_` 发布给 Node 侧；
- **请求方向**：`ListenReq` 常驻循环从 `pull_sock_` 读 JSON 队列，根据 `req.method` 调用 CTP SDK，并在必要时把错误透传回去。

## 构建脚本使用指南

项目提供了自动化构建脚本，简化 CTP 原生二进制的编译过程，无需手动配置 CMake。

### 脚本概览

- `scripts/build-native.sh` - 主构建脚本，在 Docker 容器中构建所有变体
- `ctp/scripts/build-variants.sh` - 内部脚本，构建三个环境变体
- `scripts/post-install.js` - 依赖安装脚本（自动运行）

### 主要构建脚本

使用 `build-native.sh` 脚本一键构建：

```bash
./scripts/build-native.sh
```

该脚本会自动：

- 检测 Linux 平台（仅支持 Linux）
- 在 Docker 容器中构建，确保环境一致性
- 构建所有三个环境变体（prod、cp、demo）
- 清理不必要的构建文件

### 构建变体说明

脚本会自动构建三个环境变体：

| 环境变体 | 用途         | 使用的库        | 生成的二进制      |
| -------- | ------------ | --------------- | ----------------- |
| `prod`   | 生产环境     | `ctp/lib/`      | `main_linux`      |
| `cp`     | 测评环境     | `ctp/lib-cp/`   | `main_linux_cp`   |
| `demo`   | OpenCTP 演示 | `ctp/lib-demo/` | `main_linux_demo` |

### 依赖管理

`post-install.js` 脚本会在安装时自动运行，处理系统依赖：

- 在 Debian 12 系统上自动安装 `libzmq3-dev`
- 其他平台会跳过依赖安装

### 使用示例

构建所有环境变体：

```bash
cd apps/vendor-ctp
./scripts/build-native.sh
```

构建完成后，通过环境变量选择运行哪个变体：

```bash
export CTP_ENV=prod  # 或 cp、demo
```

### 注意事项

- 仅支持 Linux 平台构建
- 需要 Docker 环境
- 构建过程在容器中进行，确保环境一致性
- 生成的二进制会自动包含正确的 RPATH，可直接运行

## 原生桥接的使用方式

`ctp/src/main.cpp` 会在启动时读取以下环境变量：

- `TRADER_ADDR` / `MARKET_ADDR`：交易前置与行情前置的地址（`tcp://...` 格式）。
- `BROKER_ID` / `USER_ID` / `PASSWORD`：交易账号基本信息。
- `APP_ID` / `AUTH_CODE`：终端认证所需的编号与授权码。
- （可选）`ZMQ_PUSH_URL` / `ZMQ_PULL_URL`：默认分别为 `tcp://*:5701`（Node 端 PUSH bind）与 `tcp://*:5700`（Node 端 PULL bind）。C++ 侧会自动将 `*` 替换为 `127.0.0.1` 后再连接，如需调整可同步修改生成脚本或入口代码。

Node 侧通过设置 `CTP_ENV=prod|cp|demo` 来选择启动哪份 `main_linux`，默认为 `prod`。

桥接流程如下：

1. 主线程初始化 ZeroMQ 上下文、创建 `Bridge` 实例，并调用 `Bridge::Serve()`。
2. `Bridge::Serve()` 会异步启动 `ListenReq` 循环，持续从 Node 发送的 JSON 队列中消费请求；行情相关的订阅 / 退订也在这里统一调度。
3. Node 侧按照如下格式发送请求（示例为登录）：

   ```json
   [
     {
       "request_id": 1,
       "req": {
         "method": "ReqUserLogin",
         "params": {
           "BrokerID": "9999",
           "UserID": "123456",
           "Password": "***",
           "UserProductInfo": "",
           "InterfaceProductInfo": "",
           "ProtocolInfo": "",
           "MacAddress": "",
           "OneTimePassword": "",
           "reserve1": "",
           "LoginRemark": "",
           "ClientIPPort": 0,
           "ClientIPAddress": ""
         }
       }
     }
   ]
   ```

   上述 `params` 结构直接遵循 `src/assets/ctp-types.ts` 里的 `ICThostFtdcReqUserLoginField` 接口，确保字段齐全且编码正确。

4. 一旦 CTP 返回结果，相应的 `OnRspUserLogin` 回调会被触发，`Bridge` 会把结果序列化成：

   ```json
   {
     "request_id": 1,
     "res": {
       "event": "OnRspUserLogin",
       "error_code": 0,
       "error_message": "",
       "is_last": true,
       "value": {
         "TradingDay": "20231225",
         "BrokerID": "9999",
         "UserID": "123456",
         "FrontID": 1,
         "SessionID": 42,
         ...
       }
     }
   }
   ```

   Node 侧按 `event` 匹配回包，结合 `error_code` 与 `is_last` 判定流程是否完成。行情推送（`Md_OnRtnDepthMarketData` 等）同样走统一的 ZMQ 通道，并由 `exchange.ts` 通过 `terminal.channel.publishChannel('CTP/DepthMarketData', ...)` 转发到平台。

- 交易类请求默认走 `CTP/Query` / `CTP/Query`（订单）服务；
- 行情订阅 / 退订通过新增的 `CTP/Md` 服务发送，字段格式与官方结构体保持一致（例如 `instrument_ids: string[]`）。

## 更新头文件的注意事项

1. 将新的官方头文件覆盖到 `ctp/include` 目录（确保同名）。
2. 运行构建脚本重新生成代码。
3. 检查生成差异：
   - TypeScript 接口字段是否符合预期；
   - C++ 生成的 `to_json/from_json` 是否新增了需要关注的字段（尤其是字符串长度和编码需求）。
4. 如需自定义 ZeroMQ 地址或额外的预处理逻辑，可以在生成脚本里调整模板，再重新生成。

## 常见问题

- **字符串乱码？** 所有字符串字段默认使用 `codec_convert` 在 GBK 与 UTF-8 间互转。若上游传入的字符串长度超过 CTP 定义的数组长度，会在 `std::strncpy` 时被截断，需要在 Node 侧自行截断或扩展处理。
- **新增的 SPI 回调/请求未生效？** 确保头文件确实更新，并重新运行生成脚本。生成器会自动识别 `CThostFtdcTraderSpi`/`CThostFtdcTraderApi` 中的新增虚函数。
- **想快速验证生成结果？** 可以运行生成脚本后执行 `git diff apps/vendor-ctp/ctp apps/vendor-ctp/src/assets` 查看差异，再决定是否需要手工调整模板。

通过以上流程，我们保证了 vendor-ctp 子项目与 CTP 官方 SDK 的同步性，也减轻了手写桥接代码的维护成本。如需扩展到行情接口或添加新的编码策略，只要在元数据阶段补充解析逻辑，再在模板中引用即可。

## OpenCTP 支持

> 参考：http://www.openctp.cn/TTS-CTPAPI.html

vendor-ctp 支持使用 OpenCTP 开源模拟环境进行开发和测试。OpenCTP 提供了完整的 CTP API 模拟，无需真实交易账号即可进行功能验证。

### OpenCTP 环境配置

项目支持三种 CTP 环境变体：

- `prod`：生产环境，使用官方 `ctp/lib` 库
- `cp`：测评环境，使用 `ctp/lib-cp` 库
- `demo`：OpenCTP 演示环境，使用 `ctp/lib-demo` 库

要使用 OpenCTP 环境，设置环境变量：

```bash
export CTP_ENV=demo
```

### OpenCTP 前置地址配置

以下是可用的 OpenCTP 环境配置：

| 模拟平台 | 环境                                                                                       | 前置     | 地址                       |
| -------- | ------------------------------------------------------------------------------------------ | -------- | -------------------------- |
| openctp  | 7x24 环境<br>BrokerID: 无<br>AppID: 无<br>AuthCode: 无<br>品种：股票、期货、期权、ETF 期权 | 交易前置 | tcp://121.37.80.177:20002  |
|          |                                                                                            | 行情前置 | tcp://121.37.80.177:20004  |
| openctp  | 仿真环境<br>BrokerID: 无<br>AppID: 无<br>AuthCode: 无<br>品种：股票、期货、期权            | 交易前置 | tcp://121.37.90.193:20002  |
|          |                                                                                            | 行情前置 | 直连实盘行情前置           |
| openctp  | vip 仿真环境<br>BrokerID: 无<br>AppID: 无<br>AuthCode: 无<br>品种：期货、期权、ETF 期权    | 交易前置 | tcp://vip.openctp.cn:30003 |
|          |                                                                                            | 行情前置 | 直连实盘行情前置           |

### 使用示例

> 关注 openctp 公众号获取测试账号

配置环境变量连接 OpenCTP 7x24 环境：

```bash
export CTP_ENV=demo
export TRADER_ADDR=tcp://121.37.80.177:20002
export MARKET_ADDR=tcp://121.37.80.177:20004
export BROKER_ID=""
export USER_ID="14725"
export PASSWORD="123456"
export APP_ID=""
export AUTH_CODE=""
```

### OpenCTP 特性

- **无需真实账号**：使用测试账号即可进行完整的 CTP API 功能验证
- **完整模拟**：支持交易、行情、查询等所有 CTP 功能
- **开发友好**：适合在开发、调试和测试阶段使用
- **多环境支持**：提供 7x24、仿真、VIP 仿真等多种环境选择

### 环境对比

| 环境   | 用途         | 库位置          | 二进制名称        |
| ------ | ------------ | --------------- | ----------------- |
| `prod` | 生产环境     | `ctp/lib/`      | `main_linux`      |
| `cp`   | 测评环境     | `ctp/lib-cp/`   | `main_linux_cp`   |
| `demo` | OpenCTP 演示 | `ctp/lib-demo/` | `main_linux_demo` |

### Fun Facts

- OpenCTP 的 7x24 环境的行情会轮播回放历史数据
