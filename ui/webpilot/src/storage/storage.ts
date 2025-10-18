import { createKeyPair } from '@yuants/utils';
import { ExtensionConfig } from '../shared/types.js';

// 默认配置
const DEFAULT_CONFIG: ExtensionConfig = {
  hostUrl: 'ws://localhost:3000',
  privateKey: createKeyPair().private_key,
};

/**
 * 获取扩展配置
 */
export async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.local.get('extension_config');
  return result['extension_config'] || DEFAULT_CONFIG;
}

/**
 * 保存扩展配置
 */
export async function saveConfig(config: Partial<ExtensionConfig>): Promise<void> {
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig, ...config };
  await chrome.storage.local.set({ extension_config: newConfig });
}
