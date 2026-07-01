import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastApi {
  notify: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

/**
 * Provedor de toasts (notificações efêmeras). Mantém uma fila e renderiza o
 * `Toaster` no canto da tela. Usado para mensagens de erro/sucesso amigáveis.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, message: string) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, type, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      success: (message) => notify('success', message),
      error: (message) => notify('error', message),
      info: (message) => notify('info', message),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const toastStyles: Record<
  ToastType,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: 'border-brand-aqua/40',
    iconColor: 'text-brand-aqua',
  },
  error: {
    icon: AlertTriangle,
    ring: 'border-red-300',
    iconColor: 'text-red-500',
  },
  info: {
    icon: Info,
    ring: 'border-brand-moss/30',
    iconColor: 'text-brand-moss',
  },
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map(({ id, type, message }) => {
        const { icon: Icon, ring, iconColor } = toastStyles[type];
        return (
          <div
            key={id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${ring} bg-white px-4 py-3 shadow-card`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} strokeWidth={1.8} />
            <p className="flex-1 text-sm text-brand-moss">{message}</p>
            <button
              type="button"
              onClick={() => onDismiss(id)}
              className="shrink-0 rounded-md p-0.5 text-brand-gray transition hover:text-brand-moss"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
