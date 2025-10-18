import { createKeyPair } from '@yuants/utils';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionConfig } from '../shared/types.js';
import { getConfig, saveConfig } from '../storage/storage.js';

const Popup: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig>({
    hostUrl: '',
    privateKey: createKeyPair().private_key,
  });
  const [isSaving, setIsSaving] = useState(false);

  // 加载配置和统计数据
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await getConfig();
      setConfig(savedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveConfig(config);
      // 显示保存成功提示
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = '配置已保存';
        statusElement.className = 'status enabled';
        setTimeout(() => {
          statusElement.textContent = '';
          statusElement.className = 'status';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = '保存失败';
        statusElement.className = 'status disabled';
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof ExtensionConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div>
      {/* 状态显示 */}
      <div id="status" className="status"></div>

      {/* 主机地址配置 */}
      <div className="form-group">
        <label htmlFor="hostUrl">主机地址 URL:</label>
        <input
          type="url"
          id="hostUrl"
          value={config.hostUrl}
          onChange={(e) => handleInputChange('hostUrl', e.target.value)}
          placeholder="http://localhost:3000"
        />
      </div>
      {/* 操作按钮 */}
      <div className="form-group">
        <button id="saveConfig" className="btn-primary" onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
};

// 渲染 React 组件
const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
