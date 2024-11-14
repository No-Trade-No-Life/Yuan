import { ToastFactory } from '@douyinfe/semi-ui';
import { ToastReactProps } from '@douyinfe/semi-ui/lib/es/toast';

export type ToastProps = string | Omit<ToastReactProps, 'type'>;
/**
 * Yuan Toast Component
 */
export const Toast: {
  info: (props: ToastProps) => string;
  error: (props: ToastProps) => string;
  success: (props: ToastProps) => string;
  warning: (props: ToastProps) => string;
  close: (id: string) => void;
} = ToastFactory.create({
  getPopupContainer: () => document.getElementById('root') as HTMLElement,
});
