import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Tooltip } from '../ui/Tooltip';

export interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'warning' | 'success';
  isCollapsed?: boolean;
  onClick?: () => void;
  key?: React.Key;
}

export function NavItem({
  to,
  label,
  icon,
  badge,
  badgeVariant = 'secondary',
  isCollapsed = false,
  onClick,
}: NavItemProps) {
  const badgeStyles = {
    default: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
    secondary: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
  };

  const navContent = (
    <NavLink
      to={to}
      end={to === '/app'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 relative cursor-pointer select-none',
          isActive
            ? 'bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-950 font-semibold shadow-xs'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100',
          isCollapsed && 'justify-center px-2'
        )
      }
    >
      <span className="shrink-0 h-4.5 w-4.5 flex items-center justify-center">{icon}</span>

      {!isCollapsed && <span className="truncate flex-1">{label}</span>}

      {!isCollapsed && badge !== undefined && (
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.2 text-[10px] font-semibold leading-tight',
            badgeStyles[badgeVariant]
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={label} position="right">
        {navContent}
      </Tooltip>
    );
  }

  return navContent;
}
