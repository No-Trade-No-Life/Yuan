import React, { useEffect } from 'react';
import { executeCommand, registerCommand } from '../CommandCenter';

export const AvailableComponents: Record<string, React.ComponentType> = {};

export const registerPage = (type: string, component: React.ComponentType) => {
  AvailableComponents[type] = React.memo(() => {
    useEffect(() => {
      gtag('event', 'yuan_page_view', { type });
    }, []);
    return React.createElement(component);
  });
  registerCommand(type, (params) => executeCommand('Page.open', { type, params }));
};
