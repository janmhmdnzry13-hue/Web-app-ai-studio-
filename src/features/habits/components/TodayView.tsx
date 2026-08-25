import React from 'react';
import { Habit, HabitLog, CreateHabitDTO } from '../../../types/habit.types';
import { TodayProgressCard } from './TodayProgressCard';
import { HabitCard } from './HabitCard';
import { HabitEmptyState } from './HabitEmptyState';
import { Flame, Trophy, Heart, Sparkles, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { getLocalDateString } from '../../../lib/dateUtils';

interface TodayViewProps {
  displayName?: string;
  habits: readonly Habit[];
  logs: readonly HabitLog[];
  userWhy: string;
  onOpenEditWhy: () => void;
  onToggleComplete: (habitId: string) => void;
  onUpdateValue: (habitId: string, value: number) => void;
  onOpenDetail: (habit: Habit) => void;
  onCreateClick: (template?: Partial<CreateHabitDTO>) => void;
}

export function TodayView({
  displayName,
  habits,
  logs,
  userWhy,
  onOpenEditWhy,
  onToggleComplete,
  onUpdateValue,
  onOpenDetail,
  onCreateClick,
}: TodayViewProps) {
  const todayStr = getLocalDateString(new Date());

  // Filter habits applicable for today
  const activeHabits = habits.filter((h) => !h.isArchived);

  // Calculate top streak and longest streak across user's habits
  const topCurrentStreak = activeHabits.length > 0
    ? Math.max(...activeHabits.map((h) => h.streak?.currentStreak || 0), 0)
    : 0;

  const topLongestStreak = activeHabits.length > 0
    ? Math.max(...activeHabits.map((h) => h.streak?.longestStreak || 0), 0)
    : 0;

  if (activeHabits.length === 0) {
    return (
      <div className="space-y-6">
        <TodayProgressCard
          displayName={displayName}
          habits={[]}
          logs={logs}
          onCreateClick={onCreateClick}
        />
        <HabitEmptyState onCreateClick={onCreateClick} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Bento Progress Card */}
      <TodayProgressCard
        displayName={displayName}
        habits={activeHabits}
        logs={logs}
        onCreateClick={onCreateClick}
      />

      {/* Today's Habits Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              Today&apos;s Habits
            </h2>
            <span className="text-xs text-neutral-400 dark:text-[#707A75]">
              ({activeHabits.length})
            </span>
          </div>

          <button
            type="button"
            onClick={() => onCreateClick()}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Habit</span>
          </button>
        </div>

        {/* Vertical Habit Cards List */}
        <div className="grid grid-cols-1 gap-3">
          {activeHabits.map((habit) => {
            const todayLog = logs.find(
              (l) => l.habitId === habit.id && l.date === todayStr
            );
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                todayLog={todayLog}
                onToggleComplete={onToggleComplete}
                onUpdateValue={onUpdateValue}
                onOpenDetail={onOpenDetail}
              />
            );
          })}
        </div>
      </div>

      {/* Secondary Streak & Record Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="h-6 w-6 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-[#707A75]">
              Current Streak
            </span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
              {topCurrentStreak} {topCurrentStreak === 1 ? 'day' : 'days'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-[#8D9793]">
              {topCurrentStreak > 0 ? 'Keep the rhythm going!' : 'Start your streak today'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-[#707A75]">
              Longest Streak
            </span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
              {topLongestStreak} {topLongestStreak === 1 ? 'day' : 'days'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-[#8D9793]">
              Personal record milestone
            </p>
          </div>
        </div>
      </div>

      {/* Your Why Card */}
      <div className="rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 sm:p-6 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Heart className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              Your Why
            </h3>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditWhy}
            className="text-xs h-8 px-3"
          >
            Edit Your Why
          </Button>
        </div>

        <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed italic">
          &ldquo;{userWhy}&rdquo;
        </p>
      </div>

      {/* Behavioral Wisdom Quote */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
        <span className="text-lg shrink-0">🌱</span>
        <p className="text-xs text-neutral-700 dark:text-[#8D9793] leading-relaxed">
          &ldquo;Small habits, repeated consistently, lead to extraordinary results over time.&rdquo;
        </p>
      </div>
    </div>
  );
}
