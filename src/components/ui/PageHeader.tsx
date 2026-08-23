import React from 'react';
import { cn } from '../../lib/utils';
import { Badge, BadgeVariant } from './Badge';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: {
    label: string;
    variant?: BadgeVariant;
  };
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2.5 pb-4 border-b border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)] mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-[#707A75]">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <span>/</span>}
              <span className={cn(idx === breadcrumbs.length - 1 ? 'text-neutral-700 dark:text-[#F0EEE6] font-medium' : '')}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight text-neutral-900 dark:text-[#F0EEE6]">
              {title}
            </h1>
            {badge && (
              <Badge variant={badge.variant ?? 'subtle'} size="sm">
                {badge.label}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-[#8D9793] max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
