export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // em ms, 0 = persistente
  timestamp: number;
}

export interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}
