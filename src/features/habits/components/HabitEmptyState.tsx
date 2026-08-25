import React from 'react';
import { Plus, Sparkles, Droplets, Footprints, BookOpen, HeartHandshake } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { CreateHabitDTO } from '../../../types/habit.types';

interface HabitEmptyStateProps {
  onCreateClick: (template?: Partial<CreateHabitDTO>) => void;
}

export function HabitEmptyState({ onCreateClick }: HabitEmptyStateProps) {
  const suggestions = [
    {
      title: 'Drink 2L of Water',
      icon: '💧',
      category: 'Health & Vitality',
      targetUnits: 2000,
      unitLabel: 'ml',
      why: 'Stay hydrated for steady physical and cognitive energy.',
    },
    {
      title: 'Move for 20 Minutes',
      icon: '🏃',
      category: 'Health & Vitality',
      targetUnits: 20,
      unitLabel: 'mins',
      why: 'Recharge mental clarity and cardiovascular health.',
    },
    {
      title: 'Read 10 Pages',
      icon: '📖',
      category: 'Learning',
      targetUnits: 10,
      unitLabel: 'pages',
      why: 'Continuous learning through daily compound reading.',
    },
    {
      title: 'Meditate for 5 Minutes',
      icon: '🧘',
      category: 'Mind & Reflection',
      targetUnits: 5,
      unitLabel: 'mins',
      why: 'Reset mental focus and breathe calmly.',
    },
  ];

  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 sm:p-12 text-center space-y-6 bg-white/40 dark:bg-[#182024]/40">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
        <Sparkles className="h-6 w-6" />
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="text-lg sm:text-xl font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
          Build your first habit
        </h3>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#8D9793] leading-relaxed">
          Choose one small action you want to repeat. Make today's action easy, and momentum will follow.
        </p>
      </div>

      <div>
        <Button
          onClick={() => onCreateClick()}
          leftIcon={<Plus className="h-4 w-4" />}
          className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-neutral-950 font-medium px-6 py-2.5 rounded-xl shadow-xs"
        >
          Create habit
        </Button>
      </div>

      {/* Optional Starter Suggestions (Not saved until clicked and confirmed) */}
      <div className="pt-6 border-t border-neutral-200/60 dark:border-neutral-800/60 max-w-md mx-auto space-y-3">
        <span className="text-[11px] font-medium text-neutral-400 dark:text-[#707A75] block uppercase tracking-wider">
          Or start with a gentle suggestion
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                onCreateClick({
                  name: sug.title,
                  category: sug.category,
                  targetUnits: sug.targetUnits,
                  unitLabel: sug.unitLabel,
                  why: sug.why,
                  icon: sug.icon,
                  frequency: 'daily',
                })
              }
              className="p-3 rounded-xl border border-neutral-200/70 dark:border-neutral-800/80 bg-white dark:bg-[#182024] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:bg-emerald-50/20 transition-all text-xs font-medium text-neutral-800 dark:text-neutral-200 flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">{sug.icon}</span>
                <span className="truncate">{sug.title}</span>
              </div>
              <Plus className="h-3.5 w-3.5 text-neutral-400 group-hover:text-emerald-600 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
