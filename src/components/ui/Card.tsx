import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'outline';
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  key?: React.Key;
}

export function Card({ className, variant = 'default', ...props }: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-neutral-900/90 border border-neutral-200/70 dark:border-neutral-800/80 shadow-xs backdrop-blur-xs',
    elevated: 'bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm',
    subtle: 'bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/50',
    outline: 'bg-transparent border border-neutral-200 dark:border-neutral-800',
  };

  return (
    <div
      className={cn(
        'rounded-xl text-neutral-900 dark:text-neutral-100 transition-all duration-150',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-sm sm:text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-5 pt-0 border-t border-neutral-100 dark:border-neutral-800/60 mt-3', className)} {...props} />;
}
