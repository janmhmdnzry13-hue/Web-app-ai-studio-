import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShell } from '../../context/ShellContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SYSTEM_MODULES } from '../../config/constants';
import {
  Search,
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
  Sun,
  Moon,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useShell();
  const { theme, setTheme } = useTheme();
  const { logout, user } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Build searchable commands list
  const navigationCommands = SYSTEM_MODULES.map((mod) => ({
    id: `nav_${mod.id}`,
    title: `Go to ${mod.name}`,
    category: 'Navigation',
    subtitle: mod.description,
    icon: iconMap[mod.iconName] ?? <LayoutDashboard className="h-4 w-4" />,
    action: () => {
      navigate(mod.path);
      setCommandPaletteOpen(false);
    },
  }));

  const systemCommands = [
    {
      id: 'cmd_theme_toggle',
      title: `Switch Theme to ${theme === 'dark' ? 'Light' : 'Dark'}`,
      category: 'System',
      subtitle: 'Toggle user interface appearance',
      icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        info(`Theme updated to ${theme === 'dark' ? 'Light' : 'Dark'}`);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd_logout',
      title: 'Sign Out Session',
      category: 'Account',
      subtitle: user ? `Signed in as ${user.email}` : 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      action: async () => {
        await logout();
        navigate('/login');
        setCommandPaletteOpen(false);
      },
    },
  ];

  const allCommands = [...navigationCommands, ...systemCommands];

  const filteredCommands = query.trim()
    ? allCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query.toLowerCase()) ||
          cmd.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  const handleSelect = (index: number) => {
    const item = filteredCommands[index];
    if (item) {
      item.action();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative z-10 w-full max-w-xl rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Bar */}
        <div className="flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800">
          <Search className="h-4 w-4 text-neutral-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelect(selectedIndex);
              }
            }}
            placeholder="Search commands, navigate modules, or run actions... (ESC to close)"
            className="w-full h-12 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-neutral-100 dark:divide-neutral-800/40">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No matching modules or commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleSelect(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer',
                  selectedIndex === idx
                    ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-700 dark:text-neutral-300'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-7 w-7 rounded-md bg-neutral-200/60 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0">
                    {cmd.icon}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold">{cmd.title}</p>
                    {cmd.subtitle && (
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{cmd.subtitle}</p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 shrink-0 ml-2">
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900/80 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px] text-neutral-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span>ORIGIN Command Engine</span>
        </div>
      </div>
    </div>
  );
}
