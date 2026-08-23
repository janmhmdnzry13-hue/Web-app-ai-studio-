import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap cursor-pointer active:scale-[0.98]';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 shadow-xs focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100',
      secondary:
        'bg-neutral-100 text-neutral-900 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700/80 focus-visible:outline-neutral-600',
      outline:
        'border border-neutral-200/90 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 focus-visible:outline-neutral-500',
      ghost:
        'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-neutral-500',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 focus-visible:outline-rose-600 shadow-xs',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-9 px-3.5 text-xs sm:text-sm gap-2 rounded-lg',
      lg: 'h-10 px-4 text-sm gap-2.5 rounded-xl',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
