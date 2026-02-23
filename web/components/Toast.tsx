'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info, Coins } from 'lucide-react';

type ToastType = 'success' | 'warning' | 'error' | 'info' | 'credits';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const TOAST_CONFIG: Record<ToastType, { icon: any; bg: string; border: string; iconColor: string }> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success/10',
    border: 'border-success/30',
    iconColor: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    iconColor: 'text-warning',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-error/10',
    border: 'border-error/30',
    iconColor: 'text-error',
  },
  info: {
    icon: Info,
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    iconColor: 'text-accent',
  },
  credits: {
    icon: Coins,
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    iconColor: 'text-warning',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(handleDismiss, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg
        ${config.bg} ${config.border}
        ${isExiting ? 'toast-exit' : 'toast-enter'}
      `}
    >
      <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-fg text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-fg-muted text-xs mt-1">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              handleDismiss();
            }}
            className="mt-2 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            {toast.action.label} →
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4 text-fg-muted" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Convenience hooks for common toasts
export function useNotifications() {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string) => 
      addToast({ type: 'success', title, message }),
    
    warning: (title: string, message?: string) => 
      addToast({ type: 'warning', title, message }),
    
    error: (title: string, message?: string) => 
      addToast({ type: 'error', title, message }),
    
    info: (title: string, message?: string) => 
      addToast({ type: 'info', title, message }),
    
    lowCredits: (agentName: string, credits: number, onFund?: () => void) => 
      addToast({
        type: 'credits',
        title: `Low Balance: ${agentName}`,
        message: `Only $${(credits / 100).toFixed(2)} remaining. Send SOL to agent wallet.`,
        duration: 10000,
        action: onFund ? { label: 'View Agent', onClick: onFund } : undefined,
      }),
    
    agentStopped: (agentName: string) => 
      addToast({
        type: 'warning',
        title: `Agent Stopped: ${agentName}`,
        message: 'Agent ran out of SOL and was suspended. Fund the wallet to restart.',
        duration: 0, // Persist until dismissed
      }),
  };
}
