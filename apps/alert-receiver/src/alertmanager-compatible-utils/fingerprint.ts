import { TextEncoder } from 'util';

import { fnv1a64Hex } from '@yuants/utils';

/**
 * 计算 Alert 的指纹（fingerprint），与 Alertmanager/Prometheus 完全一致。
 *
 * 来源（上游实现）：
 * - Prometheus common/model（Go）
 *   - labelSetToFingerprint：github.com/prometheus/common/model/signature.go
 *     关键点：对标签名排序后，逐个喂入 FNV-1a 64 位哈希；在“标签名”和“标签值”之间、以及每个字段末尾插入分隔字节 0xff；
 *     0xff 不会出现在有效的 UTF-8 序列中，可防止字符串拼接歧义。
 *   - Alert.Fingerprint()：github.com/prometheus/common/model/alert.go
 *     实际上就是对 Alert 的 Labels 调用 labelSetToFingerprint。
 * - Alertmanager webhook 的 payload：github.com/prometheus/alertmanager/template/template.go
 *   - 模板中通过 a.Fingerprint().String() 将指纹编码为 16 位小写十六进制字符串写入 JSON。
 *
 * 为什么要如此计算：
 * - 指纹是 Alert 的“身份标识”，Alertmanager 用它做去重、分组与抑制等逻辑；
 * - 采用与上游一致的算法（排序 + 0xff 分隔 + FNV-1a 64 位）保证：
 *   1) 与标签插入顺序无关（稳定性）；
 *   2) 分隔符不会与合法 UTF-8 冲突（无歧义）；
 *   3) 与 Prometheus/Alertmanager 的指纹完全一致（跨系统对齐）。
 * - 我们在 webhook 缺失 fingerprint 字段时，需要本地重算，才能与 Alertmanager 行为保持一致。
 *
 * 输出格式：返回与 Go 侧 Fingerprint.String() 相同的 16 位、零填充、小写十六进制。
 *
 * NOTE: 如果有需要，则把下列实现移动到 @yuants/utils 库中。
 */

const SEP_BYTE = new Uint8Array([0xff]);
function encodeLabels(labels: Record<string, string>): Uint8Array {
  const buffers: Uint8Array[] = [];
  const keys = Object.keys(labels).sort();
  for (const k of keys) {
    const v = labels[k] ?? '';
    buffers.push(new TextEncoder().encode(k));
    buffers.push(SEP_BYTE);
    buffers.push(new TextEncoder().encode(v));
    buffers.push(SEP_BYTE);
  }
  // concat all
  // return Uint8Array.from(buffers.flatMap((b) => Array.from(b)));   // 不够高效

  // 预计算总长度以避免多次内存分配，高效拼接
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

export const computeAlertFingerprint = (labels: Record<string, string>): string =>
  fnv1a64Hex(encodeLabels(labels));
