# UserScript CSP 解决方案

## 问题背景

Chrome 扩展的 Content Security Policy (CSP) 严格限制 `unsafe-eval` 的使用，但 AJV 8+ 库强制使用代码编译（`new Function()`），导致 CSP 错误。

## 解决方案

我们使用 userScripts API 来创建一个在宽松 CSP 环境中运行的脚本，专门处理需要 `unsafe-eval` 的代码。

## 架构设计

```
扩展页面 (严格 CSP)
    ↓
后台脚本 (注册 userScripts)
    ↓
userScript (宽松 CSP, 运行 AJV)
    ↓
通过消息传递结果
```

## 文件结构

```
ui/webpilot/
├── src/
│   ├── user-scripts/
│   │   └── unsafe-eval-script.ts    # 专门运行需要 unsafe-eval 的代码
│   ├── background/
│   │   └── background.ts            # 注册 userScript 和通信逻辑
│   └── ...
├── dist/
│   ├── unsafe-eval-script.js        # 构建后的 userScript
│   └── ...
└── ...
```

## 使用方法

### 1. 发送验证请求

在需要 AJV 验证的地方，发送消息到 userScript：

```typescript
// 在扩展的任何地方
chrome.runtime.sendMessage(
  {
    type: 'VALIDATE_SCHEMA',
    data: {
      schema: yourSchema,
      value: dataToValidate,
    },
  },
  (response) => {
    if (response.success) {
      console.log('Validation result:', response.result);
    } else {
      console.error('Validation failed:', response.error);
    }
  },
);
```

### 2. userScript 处理验证

```typescript
// src/user-scripts/unsafe-eval-script.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_SCHEMA') {
    try {
      // 这里可以安全地使用 AJV
      const result = validateWithAjv(message.data.schema, message.data.value);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
```

## 优势

1. **安全性**: 保持扩展本身的安全性，只在 userScript 中使用 `unsafe-eval`
2. **隔离性**: userScript 在独立环境中运行，不影响扩展其他部分
3. **灵活性**: 可以动态注册和注销 userScript
4. **兼容性**: 支持 Manifest V3

## 注意事项

1. **userScripts API 状态**: 目前还在实验阶段，可能需要启用 Chrome 标志
2. **通信延迟**: 消息传递会有轻微延迟
3. **错误处理**: 需要妥善处理通信失败的情况

## 备选方案

如果 userScripts API 不可用，可以考虑：

1. **使用沙盒页面**: 创建一个沙盒化的 HTML 页面
2. **降级到 Manifest V2**: 更宽松的 CSP 策略
3. **使用替代验证库**: 如 zod、yup 等不依赖 `unsafe-eval` 的库

## 测试

构建成功后，在 Chrome 中加载扩展并检查：

1. 扩展是否能正常加载
2. userScript 是否能正确注册
3. 消息通信是否正常工作
4. AJV 验证是否能正常运行

## 故障排除

如果遇到问题：

1. 检查 Chrome 版本是否支持 userScripts API
2. 查看控制台错误信息
3. 确保所有文件都已正确构建
4. 验证 manifest.json 权限配置
