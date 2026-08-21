import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShell } from '../../context/ShellContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SYSTEM_MODULES } from '../../config/constants';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  SlidersHorizontal,
  LogOut,
  User,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';

export function Header() {
  const { toggleMobileMenu, setCommandPaletteOpen, isContextPanelOpen, toggleContextPanel } = useShell();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Find active module metadata based on current pathname
  const currentModule = SYSTEM_MODULES.find((m) => m.path === location.pathname) || {
    name: 'ORIGIN OS',
    description: 'Personal Life Operating System',
  };

  const userDropdownItems = [
    {
      id: 'profile',
      label: user?.profile.displayName || 'Profile',
      icon: <User className="h-4 w-4" />,
      onClick: () => navigate('/app/settings'),
    },
    {
      id: 'settings',
      label: 'Preferences',
      icon: <SettingsIcon className="h-4 w-4" />,
      onClick: () => navigate('/app/settings'),
    },
    { isDivider: true as const },
    {
      id: 'logout',
      label: 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      variant: 'danger' as const,
      onClick: async () => {
        await logout();
        navigate('/login');
      },
    },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-4 sm:px-6">
      {/* Left: Mobile Hamburger & Current View Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
            {currentModule.name}
          </span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <span className="hidden sm:inline-block text-xs text-neutral-400 truncate">
            Foundation Status: Operational
          </span>
        </div>
      </div>

      {/* Right: Quick Command search, Theme, Notifications, Pulse toggle, Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Command Search Trigger */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Quick command...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 px-1.5 py-0.2 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
            ⌘K
          </kbd>
        </button>

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle visual theme"
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications Icon with Badge */}
        <button
          type="button"
          onClick={() => navigate('/app/architecture')}
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </button>

        {/* Context Panel Toggle (Desktop) */}
        <button
          type="button"
          onClick={toggleContextPanel}
          aria-label="Toggle Context Panel"
          className={`hidden lg:flex rounded-lg p-2 transition-colors ${
            isContextPanelOpen
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {/* User Dropdown */}
        <Dropdown
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded-full ring-1 ring-neutral-200 dark:ring-neutral-800 p-0.5 hover:ring-neutral-400 transition-all cursor-pointer"
            >
              <div className="h-7 w-7 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
                {user?.profile.displayName.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
          }
          items={userDropdownItems}
          align="right"
        />
      </div>
    </header>
  );
}
