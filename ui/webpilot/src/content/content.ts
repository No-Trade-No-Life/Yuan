import { ContentMessage } from '../shared/types.js';

// 向后台脚本发送消息
function sendMessageToBackground(message: ContentMessage): void {
  chrome.runtime.sendMessage(message).catch((error) => {
    console.log('Failed to send message to background:', error);
  });
}

// 页面加载完成时发送消息
window.addEventListener('DOMContentLoaded', () => {
  const message: ContentMessage = {
    type: 'PAGE_LOADED',
    data: {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
  };

  sendMessageToBackground(message);
});

// 监听页面变化
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;

    const message: ContentMessage = {
      type: 'PAGE_LOADED',
      data: {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    sendMessageToBackground(message);
  }
});

observer.observe(document, { subtree: true, childList: true });

// 数据提取功能
function extractPageData(): Record<string, any> {
  const data: Record<string, any> = {
    url: window.location.href,
    title: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    headings: {
      h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent?.trim()),
      h2: Array.from(document.querySelectorAll('h2')).map((h) => h.textContent?.trim()),
      h3: Array.from(document.querySelectorAll('h3')).map((h) => h.textContent?.trim()),
    },
    links: Array.from(document.querySelectorAll('a')).map((a) => ({
      text: a.textContent?.trim(),
      href: a.href,
    })),
    images: Array.from(document.querySelectorAll('img')).map((img) => ({
      src: img.src,
      alt: img.alt,
    })),
    forms: Array.from(document.querySelectorAll('form')).map((form) => ({
      action: form.action,
      method: form.method,
      inputs: Array.from(form.querySelectorAll('input, textarea, select')).map((input) => ({
        type: input.tagName.toLowerCase(),
        name: (input as HTMLInputElement).name,
        value: (input as HTMLInputElement).value,
      })),
    })),
  };

  return data;
}

// 定时提取数据并发送
setInterval(() => {
  const data = extractPageData();

  const message: ContentMessage = {
    type: 'DATA_EXTRACTED',
    data: data,
    timestamp: Date.now(),
  };

  sendMessageToBackground(message);
}, 30000); // 每30秒提取一次数据

// 注入自定义样式
const style = document.createElement('style');
style.textContent = `
  .yuan-webpilot-highlight {
    outline: 2px solid #ff6b6b !important;
    background-color: rgba(255, 107, 107, 0.1) !important;
  }
`;
document.head.appendChild(style);

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(
  (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log('Content script received message:', message);

    switch (message.type) {
      case 'INJECT_CONTENT':
        // 执行自定义注入逻辑
        if (message.data?.selector) {
          const elements = document.querySelectorAll(message.data.selector);
          elements.forEach((element) => {
            element.classList.add('yuan-webpilot-highlight');
          });
        }
        break;

      default:
        console.log('Unknown message type in content script:', message.type);
    }

    sendResponse({ success: true });
  },
);

console.log('Yuan WebPilot content script loaded');
