import React from 'react';
import { useShell } from '../../context/ShellContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NavItem } from '../navigation/NavItem';
import { SYSTEM_MODULES } from '../../config/constants';
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Repeat,
  Wallet,
  HeartHandshake,
  Users,
  FileText,
  Sparkles,
  Compass,
  Code2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, isContextPanelOpen, toggleContextPanel } = useShell();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
    CheckSquare: <CheckSquare className="h-4 w-4" />,
    Target: <Target className="h-4 w-4" />,
    Repeat: <Repeat className="h-4 w-4" />,
    Wallet: <Wallet className="h-4 w-4" />,
    HeartHandshake: <HeartHandshake className="h-4 w-4" />,
    Users: <Users className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Sparkles: <Sparkles className="h-4 w-4" />,
    Compass: <Compass className="h-4 w-4" />,
    Code2: <Code2 className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
  };

  const coreModules = SYSTEM_MODULES.filter((m) => m.category === 'core' && m.id !== 'settings');
  const productivityModules = SYSTEM_MODULES.filter((m) => m.category === 'productivity');
  const wellnessModules = SYSTEM_MODULES.filter((m) => m.category === 'wellness');
  const intelligenceModules = SYSTEM_MODULES.filter((m) => m.category === 'intelligence');

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md transition-all duration-200 z-30 shrink-0 h-screen sticky top-0',
        isSidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between px-3.5 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-950 flex items-center justify-center font-bold text-xs font-mono tracking-tight shrink-0 shadow-xs">
            O
          </div>
          {!isSidebarCollapsed && (
            <div className="truncate">
              <span className="font-bold text-sm tracking-tight text-neutral-900 dark:text-neutral-100">
                ORIGIN
              </span>
              <span className="ml-1.5 text-[10px] font-mono text-neutral-400 font-medium">v0.1</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
        >
          {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav Link Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Core Group */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Core
            </div>
          )}
          {coreModules.map((mod) => (
            <NavItem
              key={mod.id}
              to={mod.path}
              label={mod.name}
              icon={iconMap[mod.iconName]}
              isCollapsed={isSidebarCollapsed}
            />
          ))}
        </div>

        {/* Productivity Group */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Productivity
            </div>
          )}
          {productivityModules.map((mod) => (
            <NavItem
              key={mod.id}
              to={mod.path}
              label={mod.name}
              icon={iconMap[mod.iconName]}
              isCollapsed={isSidebarCollapsed}
            />
          ))}
        </div>

        {/* Wellness & Balance */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Wellness & Life
            </div>
          )}
          {wellnessModules.map((mod) => (
            <NavItem
              key={mod.id}
              to={mod.path}
              label={mod.name}
              icon={iconMap[mod.iconName]}
              isCollapsed={isSidebarCollapsed}
            />
          ))}
        </div>

        {/* Intelligence Group */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Intelligence
            </div>
          )}
          {intelligenceModules.map((mod) => (
            <NavItem
              key={mod.id}
              to={mod.path}
              label={mod.name}
              icon={iconMap[mod.iconName]}
              isCollapsed={isSidebarCollapsed}
            />
          ))}
        </div>
      </div>

      {/* Footer Controls & User Card */}
      <div className="p-2 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-1">
        <NavItem
          to="/app/settings"
          label="Settings"
          icon={<Settings className="h-4 w-4" />}
          isCollapsed={isSidebarCollapsed}
        />

        <button
          type="button"
          onClick={toggleContextPanel}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100',
            isSidebarCollapsed && 'justify-center px-2',
            isContextPanelOpen && 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          {!isSidebarCollapsed && <span className="truncate flex-1 text-left">Daily Pulse</span>}
        </button>

        {/* User Mini Bar */}
        <div
          className={cn(
            'pt-2 mt-1 border-t border-neutral-100 dark:border-neutral-800/50 flex items-center justify-between',
            isSidebarCollapsed ? 'flex-col gap-2' : 'px-1'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs text-neutral-700 dark:text-neutral-300 shrink-0">
              {user?.profile.displayName.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {user?.profile.displayName || 'Guest'}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">{user?.email || 'origin-guest'}</p>
              </div>
            )}
          </div>

          <div className={cn('flex items-center', isSidebarCollapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
