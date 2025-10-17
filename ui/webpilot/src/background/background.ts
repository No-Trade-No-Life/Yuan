// import { Terminal } from '@yuants/protocol';
// import { UUID } from '@yuants/utils';
import { defer, map, Observable, switchMap } from 'rxjs';
import { ContentMessage, NetworkRequest } from '../shared/types.js';
import { getConfig, saveNetworkRequest } from '../storage/storage.js';

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

    userScriptsAPI.register([
      {
        id: 'test',
        matches: ['*://*/*'],
        js: [{ code: 'alert("Hi!" + document?.location?.href)' }],
      },
    ]);

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

defer(() => getConfig())
  .pipe(
    map((config) => config.hostUrl),
    switchMap(
      (hostUrl) =>
        new Observable((sub) => {
          if (hostUrl) {
            // eval('console.log("Eval is enabled in background script")');
            // const terminal = new Terminal(hostUrl, {
            //   terminal_id: `WebPilot/${UUID()}`,
            //   name: 'WebPilot Extension',
            // });
            // terminal.server.provideService<{ script: string }, any>('Eval', {}, async (msg) => {
            //   const ret = eval(msg.req.script);
            //   return { res: { code: 0, message: 'OK', data: ret } };
            // });
            // sub.next(terminal);
            // sub.add(() => {
            //   terminal.dispose();
            // });
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
