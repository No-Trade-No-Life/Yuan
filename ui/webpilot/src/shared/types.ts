// 扩展配置类型
export interface ExtensionConfig {
  hostUrl: string;
  privateKey: string;
  enabled: boolean;
  networkMonitoring: boolean;
  contentInjection: boolean;
}

// 网络请求数据
export interface NetworkRequest {
  url: string;
  method: string;
  statusCode?: number;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  body?: string;
}

// 内容脚本消息类型
export interface ContentMessage {
  type: 'PAGE_LOADED' | 'ELEMENT_FOUND' | 'DATA_EXTRACTED';
  data: any;
  timestamp: number;
}

// 后台脚本消息类型
export interface BackgroundMessage {
  type: 'CONFIG_UPDATED' | 'NETWORK_REQUEST' | 'INJECT_CONTENT';
  data: any;
}

// 存储键名
export const STORAGE_KEYS = {
  CONFIG: 'extension_config',
  NETWORK_REQUESTS: 'network_requests',
} as const;
