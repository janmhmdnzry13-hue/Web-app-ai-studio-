import React from 'react';
import { cn } from '../../lib/utils';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  onReset?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error interrupted this operation. The system captured the diagnostics.',
  code,
  onRetry,
  onReset,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 min-h-[220px]',
        className
      )}
    >
      <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 border border-red-200 dark:border-red-800">
        <AlertOctagon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
        {message}
      </p>
      {code && (
        <code className="mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
          CODE: {code}
        </code>
      )}

      {(onRetry || onReset) && (
        <div className="mt-5 flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
              Retry Action
            </Button>
          )}
          {onReset && (
            <Button size="sm" variant="outline" onClick={onReset}>
              Reset State
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
