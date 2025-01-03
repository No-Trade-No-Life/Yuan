import React, { useEffect } from 'react';
import { executeCommand, registerCommand } from '../CommandCenter';
import { Subject } from 'rxjs';

export const AvailableComponents: Record<string, React.ComponentType> = {};

export const pageRegistered$ = new Subject<string>();

export const registerPage = (type: string, component: React.ComponentType) => {
  AvailableComponents[type] = React.memo(() => {
    useEffect(() => {
      gtag('event', 'yuan_page_view', { type });
      gtag('event', `yuan_page_view_${type}`);
    }, []);
    return React.createElement(component);
  });
  registerCommand(type, (params) => executeCommand('Page.open', { type, params }));
  pageRegistered$.next(type);
};
