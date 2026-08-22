import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShell } from '../../context/ShellContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SYSTEM_MODULES } from '../../config/constants';
import { searchService, GlobalSearchResult, SearchResultType } from '../../services/search.service';
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
  ExternalLink,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

export function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useShell();
  const { theme, setTheme } = useTheme();
  const { logout, user } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SearchResultType | 'all'>('all');
  const [searchResults, setSearchResults] = useState<readonly GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
      setTypeFilter('all');
      setSearchResults([]);
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

  // Perform Live Global Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchService.search({
        query: query.trim(),
        typeFilter,
        limitPerType: 6,
      });
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
      setIsSearching(false);
      setSelectedIndex(0);
    }, 120);

    return () => clearTimeout(timer);
  }, [query, typeFilter]);

  if (!isCommandPaletteOpen) return null;

  // Static Navigation & System Commands
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
        info('Theme Updated', `Switched to ${theme === 'dark' ? 'Light' : 'Dark'} mode.`);
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

  const defaultCommands = [...navigationCommands, ...systemCommands];

  const filteredDefaultCommands = query.trim()
    ? defaultCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query.toLowerCase()) ||
          cmd.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : defaultCommands;

  const totalItemsCount = query.trim() ? searchResults.length + filteredDefaultCommands.length : filteredDefaultCommands.length;

  const handleSelect = (index: number) => {
    if (query.trim() && index < searchResults.length) {
      const match = searchResults[index];
      navigate(match.url);
      setCommandPaletteOpen(false);
    } else {
      const cmdIndex = query.trim() ? index - searchResults.length : index;
      const cmd = filteredDefaultCommands[cmdIndex];
      if (cmd) {
        cmd.action();
      }
    }
  };

  const getTypeIcon = (type: SearchResultType) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case 'goal':
        return <Target className="h-4 w-4 text-purple-500" />;
      case 'habit':
        return <Repeat className="h-4 w-4 text-amber-500" />;
      case 'note':
        return <FileText className="h-4 w-4 text-emerald-500" />;
      case 'transaction':
        return <Wallet className="h-4 w-4 text-indigo-500" />;
      case 'relationship':
        return <Users className="h-4 w-4 text-rose-500" />;
      default:
        return <Compass className="h-4 w-4 text-neutral-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unified Global Search & Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[80vh]">
        {/* Search Bar */}
        <div className="flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <Search className="h-4 w-4 text-neutral-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItemsCount));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + totalItemsCount) % Math.max(1, totalItemsCount));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelect(selectedIndex);
              }
            }}
            placeholder="Search tasks, goals, habits, transactions, notes, contacts... (ESC to exit)"
            className="w-full h-13 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 mr-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Type Pills (when searching) */}
        {query.trim().length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 bg-neutral-50/70 dark:bg-neutral-950/40 border-b border-neutral-200/60 dark:border-neutral-800/60 overflow-x-auto text-[11px]">
            <span className="text-neutral-400 font-semibold mr-1 shrink-0">Scope:</span>
            {[
              { id: 'all', label: 'All Results' },
              { id: 'task', label: 'Tasks' },
              { id: 'goal', label: 'Goals' },
              { id: 'habit', label: 'Habits' },
              { id: 'note', label: 'Notes' },
              { id: 'transaction', label: 'Finances' },
              { id: 'relationship', label: 'Contacts' },
            ].map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => setTypeFilter(scope.id as any)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors shrink-0 ${
                  typeFilter === scope.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>
        )}

        {/* Unified Results Stream */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Section 1: Live Domain Entity Matches */}
          {query.trim().length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                <span>Domain Records ({searchResults.length})</span>
                {isSearching && <span className="animate-pulse">Searching...</span>}
              </div>

              {searchResults.length === 0 && !isSearching && (
                <p className="px-3 py-2 text-xs text-neutral-400 italic">
                  No domain records matched &ldquo;{query}&rdquo; in this scope.
                </p>
              )}

              {searchResults.map((result, idx) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer',
                    selectedIndex === idx
                      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-700 dark:text-neutral-300'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="h-8 w-8 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 flex items-center justify-center shrink-0">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {result.title}
                        </p>
                        {result.badgeLabel && (
                          <Badge variant={result.badgeVariant || 'subtle'} size="sm">
                            {result.badgeLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {result.subtitle || result.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono uppercase text-neutral-400">
                    <span className="capitalize">{result.type}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Section 2: Commands & System Navigation */}
          {filteredDefaultCommands.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <span>Actions & Navigation ({filteredDefaultCommands.length})</span>
              </div>

              {filteredDefaultCommands.map((cmd, idx) => {
                const globalIndex = query.trim() ? searchResults.length + idx : idx;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleSelect(globalIndex)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer',
                      selectedIndex === globalIndex
                        ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                        : 'text-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="h-8 w-8 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0">
                        {cmd.icon}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold">{cmd.title}</p>
                        {cmd.subtitle && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{cmd.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 shrink-0">
                      {cmd.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/80 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px] text-neutral-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">↵</kbd> open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">ESC</kbd> dismiss
            </span>
          </div>
          <span>ORIGIN Unified Engine</span>
        </div>
      </div>
    </div>
  );
}
