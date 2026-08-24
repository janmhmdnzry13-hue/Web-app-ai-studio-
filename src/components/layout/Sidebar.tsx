import React, { useState } from 'react';
import { useShell } from '../../context/ShellContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NavItem } from '../navigation/NavItem';
import {
  LayoutDashboard,
  CheckSquare,
  Repeat,
  Target,
  Wallet,
  HeartHandshake,
  Users,
  FileText,
  Sparkles,
  Compass,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, isContextPanelOpen, toggleContextPanel } = useShell();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isExpandedDomainsOpen, setIsExpandedDomainsOpen] = useState(false);

  const isPro = user?.role === 'admin' || (user as any)?.subscription?.tier === 'pro';

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-neutral-200/70 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md transition-all duration-200 z-30 shrink-0 h-screen sticky top-0',
        isSidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-3.5 border-b border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-7 w-7 rounded-lg p-[1.5px] flex items-center justify-center shrink-0 shadow-xs"
            style={{ background: 'conic-gradient(from 200deg, #E3A857, #C97F5C, #57ABA0, #E3A857)' }}
          >
            <div className="h-full w-full rounded-[6.5px] bg-[#FAF8F5] dark:bg-[#10161A] flex items-center justify-center font-bold text-xs font-mono text-[#D9822B] dark:text-[#E3A857]">
              O
            </div>
          </div>
          {!isSidebarCollapsed && (
            <div className="truncate">
              <div className="font-bold text-sm tracking-tight text-neutral-900 dark:text-[#F0EEE6] flex items-center gap-1.5">
                ORIGIN
                {isPro && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    PRO
                  </span>
                )}
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-[#707A75] font-normal leading-tight">
                Your life, unhurried.
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-[#202A2E] dark:hover:text-[#F0EEE6] transition-colors cursor-pointer"
        >
          {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav Link Tree with Progressive Disclosure */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
        {/* Core Daily Loop */}
        <div className="space-y-0.5">
          {!isSidebarCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Daily Focus
            </div>
          )}
          <NavItem to="/app" label="Today & Focus" icon={<LayoutDashboard className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
          <NavItem to="/app/tasks" label="Tasks" icon={<CheckSquare className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
          <NavItem to="/app/habits" label="Habits" icon={<Repeat className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
        </div>

        {/* Extended Life Dimensions (Progressive Disclosure) */}
        <div className="space-y-0.5 pt-1">
          {!isSidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setIsExpandedDomainsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <span>Life Dimensions</span>
              {isExpandedDomainsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <div className="border-t border-neutral-200/40 dark:border-neutral-800/40 my-1" />
          )}

          {/* When expanded on full sidebar, or shown directly on collapsed */}
          {(isExpandedDomainsOpen || isSidebarCollapsed) && (
            <div className="space-y-0.5 animate-in fade-in duration-150">
              <NavItem to="/app/goals" label="Goals" icon={<Target className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/app/finances" label="Finances" icon={<Wallet className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/app/emotions" label="Reflections" icon={<HeartHandshake className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/app/relationships" label="Relationships" icon={<Users className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/app/notes" label="Notes" icon={<FileText className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
              <NavItem to="/app/insights" label="Insights" icon={<Compass className="h-4 w-4" />} isCollapsed={isSidebarCollapsed} />
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls & User Card */}
      <div className="p-2 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-0.5">
        {!isPro && !isSidebarCollapsed && (
          <Link
            to="/app/settings?tab=billing"
            className="flex items-center gap-2 px-2.5 py-2 mb-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-neutral-800 dark:text-neutral-200 hover:border-amber-500/40 transition-all text-xs group"
          >
            <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[11px] text-amber-700 dark:text-amber-400">Upgrade to Pro</div>
              <div className="text-[9px] text-neutral-500 dark:text-neutral-400 truncate">Unlimited AI & vault</div>
            </div>
          </Link>
        )}

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
            'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100 cursor-pointer',
            isSidebarCollapsed && 'justify-center px-1.5',
            isContextPanelOpen && 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          {!isSidebarCollapsed && <span className="truncate flex-1 text-left">Daily Pulse</span>}
        </button>

        {/* User Mini Bar */}
        <div
          className={cn(
            'pt-2 mt-1 border-t border-neutral-100 dark:border-neutral-800/50 flex items-center justify-between',
            isSidebarCollapsed ? 'flex-col gap-1.5' : 'px-1'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6.5 w-6.5 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-semibold text-xs text-neutral-700 dark:text-neutral-300 shrink-0">
              {user?.profile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {user?.profile?.displayName || 'Alex Vance'}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">{user?.email || 'origin-guest'}</p>
              </div>
            )}
          </div>

          <div className={cn('flex items-center', isSidebarCollapsed ? 'flex-col gap-1' : 'gap-0.5')}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
