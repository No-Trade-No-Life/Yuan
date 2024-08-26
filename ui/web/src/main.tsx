import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import React
import React from 'react';
import ReactDOM from 'react-dom/client';

// Global Styles
import '@icon-park/react/styles/index.css';
import './index.css';

// Global Libraries
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
import { DesktopLayout } from './modules/DesktopLayout';
const App = () => {
  return <DesktopLayout />;
};

const queryClient = new QueryClient();

// React Render!
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
