# @yuants/utils

`@yuants/utils` 是 Yuan 体系内的通用工具库，聚焦于异步迭代、加密、时间/数值处理以及 RxJS 辅助算子等基础能力，供上层协议、行情与交易程序共享使用。

## 快速上手

```ts
import { UUID, formatTime, roundToStep, observableToAsyncIterable } from '@yuants/utils';
import { interval, take } from 'rxjs';

console.log('ID:', UUID());
console.log('现在时间:', formatTime(Date.now()));
console.log('四舍五入到 0.01:', roundToStep(1.237, 0.01));

for await (const value of observableToAsyncIterable(interval(1000).pipe(take(3)))) {
  console.log('来自 RxJS 的异步数据:', value);
}
```

## 功能模块

- **异步迭代互操作**
  - `observableToAsyncIterable(source)`：将 RxJS Observable 转换为原生 AsyncIterable，便于 `for await` 模式消费。
  - `subjectToNativeSubject(subject$)`：把 RxJS Subject 包装成同时实现 AsyncIterable/AsyncIterator 的对象。
  - `nativeSubjectToSubject(source)`：从实现异步迭代协议的对象还原出 RxJS Subject，方便回到 RxJS 管道。
- **加密与编码工具**
  - `createKeyPair()`：生成新的 ED25519 密钥对并以 Base58 编码返回。
  - `fromSeed(seed)`：根据 32 字节种子派生稳定的 ED25519 密钥对。
  - `fromPrivateKey(privateKey)`：从 Base58 编码的私钥恢复出密钥对并校验公钥一致性。
  - `signMessage(message, privateKey)`：使用 ED25519 私钥对消息进行签名。
  - `encryptByPublicKey(data, publicKey)`：使用对方的 ED25519 公钥完成一次性盒式加密。
  - `decryptByPrivateKey(data, privateKey)`：使用本地私钥解密由 `encryptByPublicKey` 生成的数据。
  - `verifyMessage(message, signature, publicKey)`：校验签名与消息是否匹配。
  - `generateX25519KeyPair()`：生成用于密钥交换的 X25519 密钥对。
  - `deriveSharedKey(publicKey, privateKey)`：基于双方密钥计算共享密钥（Base58）。
  - `encodeBase58(data)` / `decodeBase58(data)`：提供 Base58 编码与解码的便捷封装。
  - `encrypt(data, base58_key)` / `decrypt(data, base58_key)`：使用 AES-GCM 与 Base58 密钥对二进制数据进行对称加解密。
  - `sha256(data)`：计算输入数据的 SHA-256 摘要。
- **时间与数值处理**
  - `formatTime(time, timeZone?)`：按 `yyyy-MM-dd HH:mm:ss.SSSXXX` 模板输出时间，并支持指定时区。
  - `convertDurationToOffset(duration)`：解析 RFC3339 Duration 字符串并返回毫秒偏移量。
  - `roundToStep(value, step, roundFn?)`：将数值化整到步长的整数倍，保持与步长一致的小数精度。
- **路径与字符串辅助**
  - `encodePath(...params)`：将参数拼接为支持转义 `/` 的路径片段。
  - `decodePath(path)`：反向解析带转义的路径字符串为参数数组。
  - `escapeRegExp(string)`：转义正则表达式中的特殊字符。
- **RxJS 扩展算子**
  - `batchGroupBy(keyFunc)`：按 key 对批量数据流进行分组并自动管理组的生命周期。
  - `switchMapWithComplete(fn)`：行为类似 `switchMap`，在源流完成时会取消最后一个订阅。
  - `rateLimitMap(fn, reject, rateLimitConfig?, scheduler?)`：实现令牌桶速率限制，可自定义超限处理逻辑。
  - `listWatch(keyFunc, consumer, comparator?)`：监听列表增删改并为每个元素绑定生命周期 Observable。
  - `listWatchEvent(keyFunc?, comparator?)`：将列表变化转换为 `[old, new]` 事件序列。
- **其他工具**
  - `UUID()`：基于 Web Crypto 提供的 `crypto.randomUUID` 生成随机字符串。

## 与其他子包的关系

- `@yuants/protocol`、`@yuants/sql` 等核心库依赖此包提供的基础能力，是整个 Yuan 体系的重要底座。
- 建议在编写新的子项目时优先复用这里的工具函数，保持行为一致并降低重复实现成本。

如需查看更详细的 API 注释，可参阅源码或构建产出的类型声明文件。
