import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { ToastContainer } from '../ui/Toast';

export function PublicLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-neutral-900">
      {/* Public Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-6 sm:px-12">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-950 flex items-center justify-center font-bold text-sm font-mono tracking-tight shadow-xs transition-transform group-hover:scale-105">
            O
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-neutral-100">
              ORIGIN
            </span>
            <span className="text-xs text-neutral-400 font-medium">Life OS</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <nav className="flex items-center gap-3 text-xs font-medium">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-3.5 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-xs"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Public Page View */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Public Minimal Footer */}
      <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-8 px-6 sm:px-12 text-center text-xs text-neutral-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 ORIGIN Architecture Foundation. Personal Life Operating System.</p>
          <div className="flex items-center gap-6">
            <span>Phase 1: Architecture & Foundation</span>
            <span>Security: Isolated User Contracts</span>
          </div>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
}
