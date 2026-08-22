import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ContextPanel } from './ContextPanel';
import { BottomNav } from './BottomNav';
import { CommandPalette } from '../ui/CommandPalette';
import { ToastContainer } from '../ui/Toast';
import { FloatingAIAssistant } from '../ai/FloatingAIAssistant';
import { useShell } from '../../context/ShellContext';
import { SYSTEM_MODULES } from '../../config/constants';
import { X, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
} from 'lucide-react';

export function AppShell() {
  const { isMobileMenuOpen, setMobileMenuOpen } = useShell();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-x-hidden">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />

        <div className="flex flex-1 min-w-0">
          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 md:pb-12 max-w-7xl mx-auto w-full">
            <Outlet />
          </main>

          {/* Contextual Intelligence & Pulse Area */}
          <ContextPanel />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Mobile Fullscreen Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-white dark:bg-neutral-900 animate-in fade-in duration-150">
          <div className="flex h-14 items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold font-mono text-xs">
                O
              </div>
              <span className="font-bold text-sm">ORIGIN System Directory</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-neutral-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {SYSTEM_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  navigate(mod.path);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                    {iconMap[mod.iconName]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{mod.name}</p>
                    <p className="text-[11px] text-neutral-400">{mod.description}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase text-neutral-400">
                  {mod.phase === 1 ? 'Core' : 'Phase 2'}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold">
                {user?.profile.displayName.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium">{user?.profile.displayName || 'Guest'}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Command Palette, Floating AI Co-Pilot, and Toast Stack */}
      <FloatingAIAssistant />
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
