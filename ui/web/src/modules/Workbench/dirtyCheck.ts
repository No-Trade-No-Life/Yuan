import { useEffect } from 'react';

/**
 * Hook to use the page closing confirm
 *
 * usePageClosingConfirm hook is used to show a confirmation dialog when the user tries to close/refresh the page.
 *
 * recommend to use this hook in the component where you want to show the confirmation dialog.
 *
 * for example, some component with complex form data that the user might lose if they close the page.
 */
export const usePageClosingConfirm = (disabled = false) =>
  useEffect(() => {
    if (disabled) return;
    const listener = (e: BeforeUnloadEvent): void => {
      // Cancel the event
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '?';
    };
    window.addEventListener('beforeunload', listener);
    return () => {
      window.removeEventListener('beforeunload', listener);
    };
  }, [disabled]);
