import { TextEncoder } from 'util';

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
 */

const FNV_OFFSET_64 = 14695981039346656037n;
const FNV_PRIME_64 = 1099511628211n;
const MASK_64 = (1n << 64n) - 1n;
const SEP_BYTE = 0xff;

const textEncoder = new TextEncoder();

const fnv1a64Update = (h: bigint, bytes: Uint8Array): bigint => {
  let x = h;
  for (let i = 0; i < bytes.length; i++) {
    x ^= BigInt(bytes[i]);
    x = (x * FNV_PRIME_64) & MASK_64;
  }
  return x;
};

const fnv1a64AddSep = (h: bigint): bigint => {
  let x = h ^ BigInt(SEP_BYTE);
  x = (x * FNV_PRIME_64) & MASK_64;
  return x;
};

export const computeAlertFingerprint = (labels: Record<string, string>): string => {
  let h = FNV_OFFSET_64;
  const keys = Object.keys(labels).sort();
  for (const k of keys) {
    const v = labels[k] ?? '';
    h = fnv1a64Update(h, textEncoder.encode(k));
    h = fnv1a64AddSep(h);
    h = fnv1a64Update(h, textEncoder.encode(v));
    h = fnv1a64AddSep(h);
  }
  // Format as 16-digit, zero-padded lowercase hex
  let hex = h.toString(16);
  if (hex.length < 16) hex = '0'.repeat(16 - hex.length) + hex;
  return hex;
};

// Convenience: decimal form if needed by callers
export const computeAlertFingerprintDecimal = (labels: Record<string, string>): string => {
  // Return unsigned decimal string
  return (function toUnsignedDecimal(x: bigint): string {
    return x.toString(10);
  })(
    (() => {
      let h = FNV_OFFSET_64;
      const keys = Object.keys(labels).sort();
      for (const k of keys) {
        const v = labels[k] ?? '';
        h = fnv1a64Update(h, textEncoder.encode(k));
        h = fnv1a64AddSep(h);
        h = fnv1a64Update(h, textEncoder.encode(v));
        h = fnv1a64AddSep(h);
      }
      return h & MASK_64;
    })(),
  );
};
