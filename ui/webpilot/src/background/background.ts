import { setupHandShakeService, Terminal } from '@yuants/protocol';
import {
  decryptByPrivateKey,
  encrypt,
  formatTime,
  fromPrivateKey,
  listWatch,
  verifyMessage,
} from '@yuants/utils';
import { defer, map, Observable } from 'rxjs';
import { ContentMessage, NetworkRequest } from '../shared/types.js';
import { getConfig, saveNetworkRequest } from '../storage/storage.js';

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  // @ts-ignore
  if (typeof uint8Array.toBase64 === 'function') {
    // @ts-ignore
    return uint8Array.toBase64();
  }

  // 将 Uint8Array 转换为二进制字符串
  const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join('');

  // 使用 btoa 编码为 Base64
  return btoa(binaryString);
}

// 初始化后台脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log('Yuan WebPilot extension installed');

  // 注册 userScript 来处理需要 unsafe-eval 的代码
  registerUserScript();
});

// 注册 userScript
async function registerUserScript() {
  try {
    console.log('Attempting to register userScript...');

    // 检查 userScripts API 是否可用（实验性 API）
    const userScriptsAPI = (chrome as any).userScripts;
    if (!userScriptsAPI) {
      console.warn('userScripts API is not available, using alternative approach');
      fallbackToScriptingAPI();
      return;
    }

    // 获取已注册的 userScripts
    const registeredScripts = await userScriptsAPI.getScripts();
    console.info('Registered userScripts:', registeredScripts);

    // 检查是否已经注册过
    const existingScript = registeredScripts.find((script: any) => script.id === 'yuan-unsafe-eval-script');
    if (existingScript) {
      console.log('UserScript already registered:', existingScript);
      return;
    }

    // 注册新的 userScript
    await userScriptsAPI.register([
      {
        id: 'yuan-unsafe-eval-script',
        matches: ['<all_urls>'],
        js: [{ file: 'unsafe-eval-script.js' }],
        runAt: 'document_start',
        world: 'USER_SCRIPT', // 在 user script 世界中运行
      },
    ]);
    userScriptsAPI.configureWorld({
      csp: "script-src 'self'",
      // messaging: true,
    });

    console.log('UserScript registered successfully');
  } catch (error) {
    console.warn('UserScript registration failed, falling back to alternative approach:', error);
    // 如果 userScripts API 不可用，使用其他方法
    fallbackToScriptingAPI();
  }
}

// 备选方案：使用 scripting API
async function fallbackToScriptingAPI() {
  try {
    console.log('Falling back to scripting API for unsafe-eval operations');

    // 这里可以使用 scripting API 来注入脚本
    // 但需要注意 CSP 限制
  } catch (error) {
    console.error('Fallback approach also failed:', error);
  }
}

// 监听来自 userScript 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USERSCRIPT_READY') {
    console.log('UserScript is ready:', message.data);
    sendResponse({ success: true });
  }

  if (message.type === 'VALIDATE_SCHEMA_RESULT') {
    console.log('Received validation result from userScript:', message.data);
    sendResponse({ success: true });
  }

  return true;
});

const TRUSTED_PUBLIC_KEY = '76Fo6N5gM9cUUdR3hU6vfLY2iXKkt5bffhPuDHr9XKto';

defer(() => getConfig())
  .pipe(
    map((config) => [config]),
    listWatch(
      (config) => config.hostUrl,
      (config) =>
        new Observable((sub) => {
          if (config.hostUrl) {
            const keyPair = fromPrivateKey(config.privateKey);
            const terminal = new Terminal(config.hostUrl, {
              terminal_id: `WebPilot/${keyPair.public_key}`,
              name: 'WebPilot Extension Background Script',
            });

            const mapX25519PublicKeyToSharedKey = setupHandShakeService(terminal, keyPair.private_key);

            Object.assign(globalThis, { mapX25519PublicKeyToSharedKey });

            let ack_seq_id = '';

            terminal.server.provideService<
              {
                public_key: string;
                seq_id: string;
                signature: string;
                x25519_public_key: string;
              },
              string
            >(
              'ListTabs',
              {
                type: 'object',
                required: ['public_key', 'seq_id', 'signature', 'x25519_public_key'],
                properties: {
                  public_key: { type: 'string', const: keyPair.public_key },
                  x25519_public_key: { type: 'string' },
                  seq_id: { type: 'string' },
                  signature: { type: 'string' },
                },
              },
              async ({ req }) => {
                const shared_key = mapX25519PublicKeyToSharedKey.get(req.x25519_public_key);

                if (!shared_key) {
                  return {
                    res: {
                      code: 400,
                      message: 'No shared key found for the provided x25519_public_key',
                    },
                  };
                }

                const t1 = Date.now();
                // 验证请求签名
                const isValid = verifyMessage(req.seq_id, req.signature, TRUSTED_PUBLIC_KEY);
                if (!isValid) {
                  return {
                    res: {
                      code: 400,
                      message: 'Invalid signature',
                    },
                  };
                }

                // 新请求的 seq_id 必须大于上次处理的 ack_seq_id
                if (ack_seq_id && req.seq_id <= ack_seq_id) {
                  return {
                    res: {
                      code: 400,
                      message: 'seq_id must be greater than previous ack_seq_id',
                    },
                  };
                }
                ack_seq_id = req.seq_id;

                const t2 = Date.now();
                const tabs = await chrome.tabs.query({});
                const data = new TextEncoder().encode(JSON.stringify(tabs));
                const t3 = Date.now();
                const _t = await encrypt(data, shared_key);
                const t4 = Date.now();
                const encrypted_data = uint8ArrayToBase64(_t);

                const t5 = Date.now();

                console.info(
                  formatTime(Date.now()),
                  'ListTabs processed',
                  `timing: verifySig=${t2 - t1}ms, queryTabs=${t3 - t2}ms, encrypt=${
                    t4 - t3
                  }ms, encodeBase64=${t5 - t4}ms`,
                );

                return {
                  res: {
                    code: 0,
                    message: 'OK',
                    data: encrypted_data,
                  },
                };
              },
            );

            const userScriptsAPI = (chrome as any).userScripts;

            terminal.server.provideService<
              {
                public_key: string;
                x25519_public_key: string;
                signature: string;
                encrypted_data: string;
                seq_id: string;
              },
              any
            >(
              'ExecuteUserScript',
              {
                type: 'object',
                required: ['public_key', 'encrypted_data', 'seq_id', 'signature', 'x25519_public_key'],
                properties: {
                  public_key: { type: 'string', const: keyPair.public_key },
                  x25519_public_key: { type: 'string' },
                  seq_id: { type: 'string' },
                  signature: { type: 'string' },
                  encrypted_data: { type: 'string' },
                },
              },
              async ({ req }) => {
                const shared_key = mapX25519PublicKeyToSharedKey.get(req.x25519_public_key);

                if (!shared_key) {
                  return {
                    res: {
                      code: 400,
                      message: 'No shared key found for the provided x25519_public_key',
                    },
                  };
                }

                // 验证请求签名
                const isValid = verifyMessage(req.seq_id, req.signature, TRUSTED_PUBLIC_KEY);
                if (!isValid) {
                  return {
                    res: {
                      code: 400,
                      message: 'Invalid signature',
                    },
                  };
                }

                // 新请求的 seq_id 必须大于上次处理的 ack_seq_id
                if (ack_seq_id && req.seq_id <= ack_seq_id) {
                  return {
                    res: {
                      code: 400,
                      message: 'seq_id must be greater than previous ack_seq_id',
                    },
                  };
                }
                ack_seq_id = req.seq_id;

                const decrypted = decryptByPrivateKey(
                  new TextEncoder().encode(req.encrypted_data),
                  keyPair.private_key,
                );

                if (!decrypted) {
                  return {
                    res: {
                      code: 400,
                      message: 'Decryption failed',
                    },
                  };
                }

                const execReq = JSON.parse(new TextDecoder().decode(decrypted)) as {
                  tabId: number;
                  script: string;
                };

                const ret = await userScriptsAPI.execute({
                  target: { tabId: execReq.tabId },
                  js: [{ code: execReq.script }],
                });

                const data = uint8ArrayToBase64(
                  await encrypt(new TextEncoder().encode(JSON.stringify(ret)), shared_key),
                );

                return { res: { code: 0, message: 'OK', data: data } };
              },
            );

            sub.add(() => {
              terminal.dispose();
            });
          }
        }),
    ),
  )
  .subscribe();

// 监听网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details: chrome.webRequest.WebRequestBodyDetails) => {
    getConfig().then((config) => {
      if (config.enabled && config.networkMonitoring) {
        const request: NetworkRequest = {
          url: details.url,
          method: details.method,
          timestamp: Date.now(),
        };

        saveNetworkRequest(request).catch(console.error);
      }
    });
  },
  { urls: ['<all_urls>'] },
);

// 监听网络响应
chrome.webRequest.onCompleted.addListener(
  (details: chrome.webRequest.WebResponseDetails) => {
    getConfig().then((config) => {
      if (config.enabled && config.networkMonitoring) {
        const request: NetworkRequest = {
          url: details.url,
          method: 'GET', // 简化处理，实际应该从请求头获取
          statusCode: details.statusCode,
          timestamp: Date.now(),
        };

        saveNetworkRequest(request).catch(console.error);
      }
    });
  },
  { urls: ['<all_urls>'] },
);

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(
  (message: ContentMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log('Background received message:', message);

    getConfig().then((config) => {
      if (!config.enabled) return;

      switch (message.type) {
        case 'PAGE_LOADED':
          console.log('Page loaded:', sender.tab?.url);
          break;

        case 'DATA_EXTRACTED':
          console.log('Data extracted:', message.data);
          // 这里可以将数据发送到配置的主机地址
          if (config.hostUrl) {
            // fetch(config.hostUrl, {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify({
            //     type: 'extracted_data',
            //     data: message.data,
            //     url: sender.tab?.url,
            //     timestamp: Date.now(),
            //   }),
            // }).catch(console.error);
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    });

    sendResponse({ success: true });
  },
);

// 监听标签页更新
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    getConfig().then((config) => {
      if (config.enabled && config.contentInjection) {
        // 可以在这里执行额外的注入逻辑
        console.log('Tab updated:', tab.url);
      }
    });
  }
});

console.log('Yuan WebPilot background script loaded');
