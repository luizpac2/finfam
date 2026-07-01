import { useContext } from 'react';

import { ToastContext, type ToastApi } from '../context/ToastContext';

/**
 * Hook de acesso à API de toasts.
 * Falha cedo (fail-fast) caso seja usado fora do `ToastProvider`.
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast deve ser usado dentro de um <ToastProvider>.');
  }
  return context;
}
