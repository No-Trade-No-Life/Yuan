import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionConfig } from '../shared/types.js';
import { getConfig, saveConfig, getNetworkRequests, clearNetworkRequests } from '../storage/storage.js';

eval('console.log("Eval is enabled in popup script")');

const Popup: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig>({
    hostUrl: '',
    enabled: true,
    networkMonitoring: true,
    contentInjection: true,
  });
  const [requestCount, setRequestCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>('-');
  const [isSaving, setIsSaving] = useState(false);

  // 加载配置和统计数据
  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await getConfig();
      setConfig(savedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadStats = async () => {
    try {
      const requests = await getNetworkRequests();
      setRequestCount(requests.length);

      if (requests.length > 0) {
        const lastRequest = requests[requests.length - 1];
        setLastUpdate(new Date(lastRequest.timestamp).toLocaleString('zh-CN'));
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
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

  const handleClearRequests = async () => {
    try {
      await clearNetworkRequests();
      setRequestCount(0);
      setLastUpdate('-');

      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = '请求记录已清空';
        statusElement.className = 'status enabled';
        setTimeout(() => {
          statusElement.textContent = '';
          statusElement.className = 'status';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to clear requests:', error);
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
      <div className={`status ${config.enabled ? 'enabled' : 'disabled'}`}>
        {config.enabled ? '扩展已启用' : '扩展已禁用'}
      </div>

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

      {/* 功能开关 */}
      <div className="form-group">
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="enabled"
            checked={config.enabled}
            onChange={(e) => handleInputChange('enabled', e.target.checked)}
          />
          <label htmlFor="enabled">启用扩展</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="networkMonitoring"
            checked={config.networkMonitoring}
            onChange={(e) => handleInputChange('networkMonitoring', e.target.checked)}
          />
          <label htmlFor="networkMonitoring">网络请求监控</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="contentInjection"
            checked={config.contentInjection}
            onChange={(e) => handleInputChange('contentInjection', e.target.checked)}
          />
          <label htmlFor="contentInjection">内容脚本注入</label>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="form-group">
        <button id="saveConfig" className="btn-primary" onClick={handleSaveConfig} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      <div className="form-group">
        <button id="clearRequests" className="btn-secondary" onClick={handleClearRequests}>
          清空请求记录
        </button>
      </div>

      {/* 统计信息 */}
      <div className="stats">
        <div>
          网络请求数: <span id="requestCount">{requestCount}</span>
        </div>
        <div>
          最后更新: <span id="lastUpdate">{lastUpdate}</span>
        </div>
      </div>
    </div>
  );
};

// 渲染 React 组件
const container = document.getElementById('status')?.parentElement;
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
