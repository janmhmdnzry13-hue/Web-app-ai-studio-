import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, checked, disabled, ...props }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? `cb_${label.toLowerCase().replace(/\s+/g, '_')}` : undefined);

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-3 cursor-pointer select-none group',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div className="h-4.5 w-4.5 rounded border border-neutral-300 bg-white transition-all peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900 peer-focus-visible:ring-offset-1 dark:border-neutral-700 dark:bg-neutral-900 dark:peer-checked:border-neutral-100 dark:peer-checked:bg-neutral-100 dark:peer-focus-visible:ring-neutral-100 flex items-center justify-center">
            <Check className="h-3 w-3 text-white dark:text-neutral-900 opacity-0 transition-opacity peer-checked:opacity-100 stroke-[3]" />
          </div>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>}
            {description && <span className="text-xs text-neutral-500 dark:text-neutral-400">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
