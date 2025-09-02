import { formatTime } from '@yuants/utils';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { reconcile } from '.';

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
使用方法: prometheus-rule-controller <rule-dir-path> <prometheus-url>

参数:
  rule-dir-path     Prometheus 规则文件目录的路径 (必需)
  prometheus-url    Prometheus 服务器的 URL (必需)

选项:
  -h, --help       显示此帮助信息

示例:
  prometheus-rule-controller ./rules http://localhost:9090
  prometheus-rule-controller /path/to/prometheus/rules https://prometheus.example.com

说明:
  - rule-dir-path: 指向包含 Prometheus 规则 YAML 文件的目录路径
  - prometheus-url: Prometheus 服务器的完整 URL，包括协议和端口
`);
}

function showError(message: string) {
  console.error(`错误: ${message}`);
  console.error('使用 -h 或 --help 查看使用说明');
  process.exit(1);
}

// 检查帮助参数
if (args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(0);
}

// 检查参数数量
if (args.length < 2) {
  if (args.length === 0) {
    showError('缺少必需的参数');
  } else if (args.length === 1) {
    showError('缺少 prometheus-url 参数');
  }
}

if (args.length > 2) {
  showError('参数过多，只需要两个参数');
}

const configDirPath = args[0];
const prometheusUrl = args[1];

// 验证规则目录路径
if (!configDirPath) {
  showError('规则目录路径不能为空');
}

const resolvedConfigPath = resolve(configDirPath);
if (!existsSync(resolvedConfigPath)) {
  showError(`规则目录不存在: ${resolvedConfigPath}`);
}

// 检查是否为目录
const { statSync } = require('fs');
if (!statSync(resolvedConfigPath).isDirectory()) {
  showError(`路径不是目录: ${resolvedConfigPath}`);
}

// 验证 Prometheus URL
if (!prometheusUrl) {
  showError('Prometheus URL 不能为空');
}

try {
  const url = new URL(prometheusUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    showError('Prometheus URL 必须使用 http 或 https 协议');
  }
} catch (error) {
  showError(`无效的 Prometheus URL: ${prometheusUrl}`);
}

console.info(formatTime(Date.now()), `配置目录路径: ${resolvedConfigPath}`);
console.info(formatTime(Date.now()), `Prometheus URL: ${prometheusUrl}`);

reconcile(resolvedConfigPath, prometheusUrl).subscribe();
