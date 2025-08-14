import './lib';
//
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './modules/BIOS';
// Import React
import React from 'react';
import ReactDOM from 'react-dom/client';

// Global Styles
import '@icon-park/react/styles/index.css';
import './index.css';

// Global Libraries
import { ConfigProvider } from '@douyinfe/semi-ui';
import * as Kernel from '@yuants/kernel';
import * as rx from 'rxjs';
Object.assign(globalThis, { rx, Kernel });

// Import All Modules (Vite-only feature)
const modules = import.meta.glob('./modules/*/index.ts', { eager: true });
const Modules = Object.fromEntries(
  Object.entries(modules).map(([key, value]) => {
    const item = key.match(/^\.\/modules\/(.+)\/index\.ts$/);
    return [item?.[1] ?? '', value] as const;
  }),
);
Object.assign(globalThis, { Modules });

// Layout -> App
import { Launch } from './modules/BIOS';
import { DesktopLayout } from './modules/DesktopLayout';
import { DarkModeEffect } from './modules/Workbench';

const queryClient = new QueryClient();

// React Render!
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider getPopupContainer={() => document.getElementById('root') as HTMLElement}>
      <QueryClientProvider client={queryClient}>
        <Launch>
          <DesktopLayout />
        </Launch>
        <DarkModeEffect />
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
