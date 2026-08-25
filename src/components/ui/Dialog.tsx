import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  className,
  contentClassName,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      aria-describedby={description ? 'dialog-desc' : undefined}
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Modal Container */}
      <div
        ref={dialogRef}
        className={cn(
          'relative z-10 w-full max-h-[min(92dvh,calc(100vh-1.5rem))] flex flex-col rounded-2xl border border-neutral-200/90 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 transition-all duration-150 overflow-hidden',
          sizeClasses[size],
          className
        )}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-3.5 top-3.5 z-20 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {(title || description) && (
          <div className="shrink-0 px-5 sm:px-6 pt-5 pb-3.5 border-b border-neutral-100 dark:border-neutral-800/80 pr-12 space-y-1">
            {title && (
              <h2 id="dialog-title" className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-desc" className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain text-sm text-neutral-800 dark:text-neutral-200 p-5 sm:p-6', contentClassName)}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
