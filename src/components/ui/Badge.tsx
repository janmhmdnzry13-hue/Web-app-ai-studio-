import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'subtle';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
}

export function Badge({ className, variant = 'default', size = 'sm', children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium',
    primary: 'bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 font-medium',
    secondary: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60',
    outline: 'border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 bg-transparent',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    info: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
    subtle: 'bg-neutral-100/70 text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400 border border-neutral-200/40 dark:border-neutral-800/40',
  };

  const sizes = {
    sm: 'text-[10px] font-medium px-2 py-0.5 rounded-md gap-1',
    md: 'text-xs font-medium px-2.5 py-0.5 rounded-md gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none shrink-0 transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
