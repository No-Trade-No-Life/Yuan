import { BehaviorSubject } from 'rxjs';

export * from './ErrorBoundary';
export * from './LocalizedPageTitle';
export { AvailableComponents, pageRegistered$, registerPage } from './model';
export { Page, usePageId, usePageParams, usePageTitle, usePageType, usePageViewport } from './Page';
export const activePage$ = new BehaviorSubject<{ page: string; pageParams: any } | null>(null);
