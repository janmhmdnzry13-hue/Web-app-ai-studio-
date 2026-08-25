import React from 'react';
import { Check, Flame, Plus, Minus, ArrowRight, Sparkles } from 'lucide-react';
import { Habit, HabitLog } from '../../../types/habit.types';
import { getLocalDateString } from '../../../lib/dateUtils';

interface HabitCardProps {
  habit: Habit;
  todayLog?: HabitLog;
  onToggleComplete: (habitId: string) => void;
  onUpdateValue: (habitId: string, newValue: number) => void;
  onOpenDetail: (habit: Habit) => void;
}

export function HabitCard({
  habit,
  todayLog,
  onToggleComplete,
  onUpdateValue,
  onOpenDetail,
}: HabitCardProps) {
  const currentValue = todayLog ? todayLog.value : 0;
  const targetUnits = habit.targetUnits || 1;
  const isCompleted = todayLog ? todayLog.targetMet : false;

  // Calculate percentage progress for progress bar
  const progressRatio = Math.min(1, Math.max(0, currentValue / targetUnits));
  const progressPercentage = Math.round(progressRatio * 100);

  // Check if habit is numeric (quantity, duration, count) vs simple binary
  const isNumeric = targetUnits > 1;

  // Formatting unit label
  const unitLabel = habit.unitLabel || (isNumeric ? 'units' : '');

  // Streak representation (forgiving & encouragement-focused)
  const currentStreak = habit.streak?.currentStreak || 0;
  const hasStreak = currentStreak > 0;

  const handleCircleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(habit.id);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const step = targetUnits >= 500 ? 250 : targetUnits >= 20 ? 5 : 1;
    const nextVal = Math.min(targetUnits * 2, currentValue + step);
    onUpdateValue(habit.id, nextVal);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const step = targetUnits >= 500 ? 250 : targetUnits >= 20 ? 5 : 1;
    const nextVal = Math.max(0, currentValue - step);
    onUpdateValue(habit.id, nextVal);
  };

  return (
    <div
      onClick={() => onOpenDetail(habit)}
      className="group relative rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-4 sm:p-5 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer select-none"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Habit Details & Category */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={`text-sm sm:text-base font-semibold truncate transition-colors ${
                isCompleted
                  ? 'text-neutral-500 dark:text-neutral-400 line-through'
                  : 'text-neutral-900 dark:text-[#F0EEE6]'
              }`}
            >
              {habit.name}
            </h3>
            {habit.icon && (
              <span className="text-sm shrink-0" role="img" aria-label="habit icon">
                {habit.icon}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-[#8D9793]">
            <span>{habit.category}</span>
            {hasStreak && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {currentStreak} day streak
                </span>
              </>
            )}
            {!hasStreak && !isCompleted && (
              <>
                <span>•</span>
                <span className="text-neutral-400 dark:text-neutral-500">Start today</span>
              </>
            )}
          </div>

          {habit.why && (
            <p className="text-[11px] italic text-neutral-400 dark:text-[#707A75] truncate max-w-sm">
              &ldquo;{habit.why}&rdquo;
            </p>
          )}

          {/* Sleek Sub-Bar for partial/in-progress habits */}
          {isNumeric && !isCompleted && currentValue > 0 && (
            <div className="pt-1.5 w-full max-w-[200px]">
              <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-[#202A2E] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Progress Value & Completion Control */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Progress Readout */}
          {isNumeric && (
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300">
                {currentValue} / {targetUnits} {unitLabel}
              </span>
              {/* Stepper buttons for quick logging on desktop / tablet */}
              <div
                className="flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={currentValue <= 0}
                  aria-label="Decrease logged amount"
                  className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-100 dark:bg-[#202A2E] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label="Increase logged amount"
                  className="h-6 w-6 rounded-md flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Primary Action Button (Check Circle) */}
          <button
            type="button"
            onClick={handleCircleClick}
            aria-label={
              isCompleted
                ? `Mark ${habit.name} as incomplete`
                : `Mark ${habit.name} as complete`
            }
            className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isCompleted
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 shadow-xs scale-105'
                : 'border-2 border-neutral-300 dark:border-neutral-700 text-transparent hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/30'
            }`}
          >
            {isCompleted ? (
              <Check className="h-5 w-5 stroke-[2.5]" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-transparent group-hover:bg-emerald-500/40 transition-colors" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
