import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Repeat,
  Wallet,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useShell } from '../../context/ShellContext';

export function BottomNav() {
  const { toggleMobileMenu } = useShell();

  const primaryItems = [
    { to: '/app', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" /> },
    { to: '/app/tasks', label: 'Tasks', icon: <CheckSquare className="h-5 w-5" /> },
    { to: '/app/habits', label: 'Habits', icon: <Repeat className="h-5 w-5" /> },
    { to: '/app/finances', label: 'Finances', icon: <Wallet className="h-5 w-5" /> },
    { to: '/app/ai', label: 'AI Co-Pilot', icon: <Sparkles className="h-5 w-5" /> },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-15">
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors gap-1 min-h-[44px]',
                isActive
                  ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-label="All Modules"
          className="flex flex-col items-center justify-center w-full h-full text-[10px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 gap-1 min-h-[44px]"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
