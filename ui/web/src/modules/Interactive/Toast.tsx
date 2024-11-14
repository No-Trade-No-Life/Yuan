import { ToastFactory } from '@douyinfe/semi-ui';
import { ToastReactProps } from '@douyinfe/semi-ui/lib/es/toast';

/**
 * Yuan Toast Component
 */
export const Toast: {
  info: (props: ToastReactProps) => string;
  error: (props: ToastReactProps) => string;
  success: (props: ToastReactProps) => string;
  warning: (props: ToastReactProps) => string;
  close: (id: string) => void;
} = ToastFactory.create({
  getPopupContainer: () => document.getElementById('root') as HTMLElement,
});
