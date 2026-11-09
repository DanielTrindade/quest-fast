import { useCallback, useContext } from 'react';
import { toast } from 'sonner';
import { ToastCard, type ToastVariant } from '../components/Toast';
import { ToasterContext } from '../lib/toaster-context';

export type Notice = { title: string; description?: string; variant?: ToastVariant };

export function useNotify() {
  const toasterId = useContext(ToasterContext);
  return useCallback(({ title, description, variant = 'info' }: Notice) => {
    toast.custom(id => <ToastCard title={title} description={description} variant={variant}
      onDismiss={() => toast.dismiss(id)} />, { toasterId });
  }, [toasterId]);
}
