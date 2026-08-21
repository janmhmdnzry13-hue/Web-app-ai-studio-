import React from 'react';
import { useShell } from '../../context/ShellContext';
import { X, Sparkles, Activity, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

export function ContextPanel() {
  const { isContextPanelOpen, setContextPanelOpen } = useShell();
  const navigate = useNavigate();

  if (!isContextPanelOpen) return null;

  return (
    <aside
      aria-label="Contextual Assistant and Daily Pulse"
      className="w-80 shrink-0 border-l border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md h-[calc(100vh-3.5rem)] sticky top-14 hidden lg:flex flex-col z-20 overflow-y-auto animate-in slide-in-from-right duration-200"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-neutral-800 dark:text-neutral-200" />
          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Daily Pulse & Intelligence</h3>
        </div>
        <button
          type="button"
          onClick={() => setContextPanelOpen(false)}
          aria-label="Close Context Panel"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="p-4 space-y-5 flex-1">
        {/* System Health / Life Index Card */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Life Balance Index</span>
            <Badge variant="success" size="sm">
              84 / 100
            </Badge>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Focus & Craft</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">88%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-neutral-900 dark:bg-neutral-100 h-full w-[88%]" />
            </div>

            <div className="flex justify-between text-neutral-600 dark:text-neutral-400 pt-1">
              <span>Wellness & Recovery</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">82%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-neutral-900 dark:bg-neutral-100 h-full w-[82%]" />
            </div>

            <div className="flex justify-between text-neutral-600 dark:text-neutral-400 pt-1">
              <span>Financial Alignment</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">80%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-neutral-900 dark:bg-neutral-100 h-full w-[80%]" />
            </div>
          </div>
        </div>

        {/* Co-Pilot Insight Snapshot */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 space-y-2 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>AI Architecture Insight</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            ORIGIN foundation contracts are validated. Ready for Phase 2 data persistence pipelines.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => navigate('/app/architecture')}
            >
              Inspect Data Contracts
            </Button>
          </div>
        </div>

        {/* Security & Isolation Status */}
        <div className="rounded-xl border border-neutral-200/60 p-4 dark:border-neutral-800/60 bg-neutral-50/30 dark:bg-neutral-900/30 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Security & Isolation</span>
          </div>
          <ul className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1">
            <li className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-neutral-400" />
              <span>User-scoped data isolation enforced</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-neutral-400" />
              <span>Zero client credentials exposure</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-neutral-400" />
              <span>Strict contract input validation</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
