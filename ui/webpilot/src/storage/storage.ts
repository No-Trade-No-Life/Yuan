import { ExtensionConfig, NetworkRequest, STORAGE_KEYS } from '../shared/types.js';

// 默认配置
const DEFAULT_CONFIG: ExtensionConfig = {
  hostUrl: 'http://localhost:3000',
  enabled: true,
  networkMonitoring: true,
  contentInjection: true,
};

/**
 * 获取扩展配置
 */
export async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  return result[STORAGE_KEYS.CONFIG] || DEFAULT_CONFIG;
}

/**
 * 保存扩展配置
 */
export async function saveConfig(config: Partial<ExtensionConfig>): Promise<void> {
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig, ...config };
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: newConfig });
}

/**
 * 获取网络请求记录
 */
export async function getNetworkRequests(): Promise<NetworkRequest[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.NETWORK_REQUESTS);
  return result[STORAGE_KEYS.NETWORK_REQUESTS] || [];
}

/**
 * 保存网络请求记录
 */
export async function saveNetworkRequest(request: NetworkRequest): Promise<void> {
  const requests = await getNetworkRequests();
  requests.push(request);

  // 只保留最近的1000个请求
  const trimmedRequests = requests.slice(-1000);
  await chrome.storage.local.set({ [STORAGE_KEYS.NETWORK_REQUESTS]: trimmedRequests });
}

/**
 * 清空网络请求记录
 */
export async function clearNetworkRequests(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.NETWORK_REQUESTS);
}
