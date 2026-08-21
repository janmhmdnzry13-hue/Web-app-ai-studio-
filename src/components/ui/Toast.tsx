import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2 sm:p-0"
    >
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          error: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />,
          info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />,
          warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />,
        };

        const borderStyles = {
          success: 'border-emerald-200 dark:border-emerald-900/60',
          error: 'border-red-200 dark:border-red-900/60',
          info: 'border-blue-200 dark:border-blue-900/60',
          warning: 'border-amber-200 dark:border-amber-900/60',
        };

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg dark:bg-neutral-900 transition-all duration-200 animate-in slide-in-from-bottom-2',
              borderStyles[toast.type]
            )}
          >
            <div className="mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss toast"
              className="rounded p-0.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
