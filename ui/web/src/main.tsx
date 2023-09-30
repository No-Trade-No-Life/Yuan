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
import.meta.glob('./modules/*/index.ts', { eager: true });

// Layout -> App
import { DesktopLayout } from './modules/DesktopLayout';
const App = () => {
  return <DesktopLayout />;
};

// React Render!
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
