// 这个 userScript 在宽松的 CSP 环境中运行，可以安全地使用 AJV
// 注意：userScripts 目前不支持 ES6 模块，所以使用传统的脚本格式

console.info(`This is the unsafe-eval userScript running in a relaxed CSP environment`);

// eval('console.log("Eval is enabled in userScript")');

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('UserScript received message:', message);

  if (message.type === 'VALIDATE_SCHEMA') {
    try {
      // 这里可以安全地使用 AJV 进行 schema 验证
      // 由于 userScript 环境更宽松，不会触发 CSP 错误
      const result = validateWithAjv(message.data.schema, message.data.value);

      sendResponse({
        success: true,
        result: result,
      });
    } catch (error) {
      console.error('Validation error in userScript:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return true; // 保持消息通道开放
});

// 模拟 AJV 验证函数
// 在实际使用中，这里会导入和使用真正的 AJV
function validateWithAjv(schema: any, data: any): boolean {
  console.log('Validating with AJV in userScript environment');
  console.log('Schema:', schema);
  console.log('Data:', data);

  // 这里可以安全地使用 new Function() 或 eval()
  // 因为 userScript 环境允许 unsafe-eval

  // 简单的验证逻辑示例
  if (schema.type === 'object' && typeof data === 'object') {
    return true;
  }

  return false;
}

// 向扩展发送就绪消息
chrome.runtime
  .sendMessage({
    type: 'USERSCRIPT_READY',
    data: { timestamp: Date.now() },
  })
  .catch((error) => {
    console.log('Failed to send ready message:', error);
  });

console.log('Yuan WebPilot userScript loaded in unsafe-eval environment');

// 添加空的 export 语句来满足 TypeScript 的 isolatedModules 要求
export {};
