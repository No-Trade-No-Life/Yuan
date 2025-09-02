#!/usr/bin/env node
import { formatTime } from '@yuants/utils';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { reconcile, reconcileK8s } from '.';

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
使用方法: 
  prometheus-rule-controller file <rule-dir-path> <prometheus-url>
  prometheus-rule-controller k8s [kubeconfig-path]

模式:
  file                 文件模式：从数据库读取规则并写入到本地文件
  k8s                  Kubernetes 模式：从数据库读取规则并操作 K8s 集群

参数:
  rule-dir-path        [文件模式] Prometheus 规则文件目录的路径 (必需)
  prometheus-url       [文件模式] Prometheus 服务器的 URL (必需)
  kubeconfig-path      [K8s模式] kubeconfig 文件路径 (可选)

选项:
  -h, --help          显示此帮助信息

示例:
  # 文件模式
  prometheus-rule-controller file ./rules http://localhost:9090
  prometheus-rule-controller file /etc/prometheus/rules https://prometheus.example.com
  
  # Kubernetes 模式
  prometheus-rule-controller k8s
  prometheus-rule-controller k8s ~/.kube/config
  prometheus-rule-controller k8s /path/to/custom/kubeconfig

说明:
  文件模式:
  - rule-dir-path: 指向包含 Prometheus 规则 YAML 文件的目录路径
  - prometheus-url: Prometheus 服务器的完整 URL，包括协议和端口
  
  K8s 模式:
  - kubeconfig-path: 可选的 kubeconfig 文件路径
  - 如果不提供 kubeconfig-path，会自动从以下位置获取：
    1. 容器环境中的 service account (fromCluster)
    2. ~/.kube/config 文件
  - 直接操作 Kubernetes 集群中的 PrometheusRule 资源
  - 不需要 Prometheus URL，规则通过 K8s Operator 自动管理
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

// 检查参数数量和模式
if (args.length < 1) {
  showError('参数不足，请指定模式');
}

const mode = args[0];
if (!['file', 'k8s'].includes(mode)) {
  showError('无效的模式，请使用 "file" 或 "k8s"');
}

let configDirPath: string | undefined;
let prometheusUrl: string = '';
let kubeconfigPath: string | undefined;

if (mode === 'file') {
  if (args.length < 3) {
    showError('文件模式需要 3 个参数：file <rule-dir-path> <prometheus-url>');
  }
  if (args.length > 3) {
    showError('文件模式参数过多，只需要 3 个参数');
  }
  configDirPath = args[1];
  prometheusUrl = args[2];
} else if (mode === 'k8s') {
  if (args.length > 2) {
    showError('K8s 模式最多接受 1 个可选参数：k8s [kubeconfig-path]');
  }
  if (args.length === 2) {
    kubeconfigPath = args[1];
  }
} else {
  showError('未知模式');
}

// 验证规则目录路径（仅文件模式）
if (mode === 'file' && configDirPath) {
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

  configDirPath = resolvedConfigPath;
}

// 验证 kubeconfig 路径（仅 K8s 模式且提供了路径）
if (mode === 'k8s' && kubeconfigPath) {
  const resolvedKubeconfigPath = resolve(kubeconfigPath);
  if (!existsSync(resolvedKubeconfigPath)) {
    showError(`kubeconfig 文件不存在: ${resolvedKubeconfigPath}`);
  }

  // 检查是否为文件
  const { statSync } = require('fs');
  if (!statSync(resolvedKubeconfigPath).isFile()) {
    showError(`kubeconfig 路径不是文件: ${resolvedKubeconfigPath}`);
  }

  kubeconfigPath = resolvedKubeconfigPath;
}

// 验证 Prometheus URL（仅文件模式）
if (mode === 'file') {
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
}

console.info(formatTime(Date.now()), `运行模式: ${mode}`);
if (mode === 'file' && configDirPath) {
  console.info(formatTime(Date.now()), `配置目录路径: ${configDirPath}`);
  console.info(formatTime(Date.now()), `Prometheus URL: ${prometheusUrl}`);
} else if (mode === 'k8s') {
  if (kubeconfigPath) {
    console.info(formatTime(Date.now()), `kubeconfig 路径: ${kubeconfigPath}`);
  } else {
    console.info(formatTime(Date.now()), `使用默认 kubeconfig (fromCluster 或 ~/.kube/config)`);
  }
}

if (mode === 'file' && configDirPath) {
  reconcile(configDirPath, prometheusUrl).subscribe();
} else if (mode === 'k8s') {
  // TODO: 实现 K8s 模式的 reconcile 函数
  // 传递 kubeconfigPath 参数（可能为 undefined）
  console.info(formatTime(Date.now()), `将使用 kubeconfig: ${kubeconfigPath || '默认配置'}`);
  reconcileK8s(kubeconfigPath).subscribe();
}
