import React from 'react';
import { Sparkles, Check, Flame, Trophy } from 'lucide-react';
import { Habit, HabitLog } from '../../../types/habit.types';
import { getLocalDateString } from '../../../lib/dateUtils';

interface TodayProgressCardProps {
  displayName?: string;
  habits: readonly Habit[];
  logs: readonly HabitLog[];
  onCreateClick: () => void;
}

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon to Sun

export function TodayProgressCard({
  displayName,
  habits,
  logs,
  onCreateClick,
}: TodayProgressCardProps) {
  const todayStr = getLocalDateString(new Date());

  // Calculate current hour for time-appropriate greeting
  const hour = new Date().getHours();
  const greetingTime =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = displayName?.split(' ')[0] || 'there';

  const totalHabits = habits.length;
  const todayCompletedHabits = habits.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === todayStr && l.targetMet)
  );
  const completedCount = todayCompletedHabits.length;

  // Calculate Daily Score (Percentage-based, minimum 0, max 100)
  const completionPercentage =
    totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

  // Contextual encouraging message
  const getEncouragement = () => {
    if (totalHabits === 0) return 'Your habits start here. Focus on one small step.';
    if (completionPercentage === 100) return 'All intentions fulfilled. Beautiful work today!';
    if (completionPercentage >= 60) return "You're building strong momentum.";
    if (completionPercentage > 0) return 'Focus on progress, not perfection.';
    return 'A fresh start today. Take the first easy step.';
  };

  const getScoreLabel = () => {
    if (totalHabits === 0) return 'Ready';
    if (completionPercentage === 100) return 'Complete!';
    if (completionPercentage >= 70) return 'Great job!';
    if (completionPercentage >= 30) return 'In motion';
    return 'Start today';
  };

  // Generate 7-day strip (Monday through Sunday for the current week)
  const weekStrip = React.useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Calculate distance to Monday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = getLocalDateString(d);
      const isToday = dStr === todayStr;
      const isPast = dStr < todayStr;
      const isFuture = dStr > todayStr;

      // Check if all expected habits for that day were completed
      const dayLogs = logs.filter((l) => l.date === dStr && l.targetMet);
      const hasCompletedAny = dayLogs.length > 0;
      const hasCompletedAll = totalHabits > 0 && dayLogs.length >= totalHabits;

      days.push({
        label: WEEKDAY_SHORT[i],
        dateStr: dStr,
        dayNum: d.getDate(),
        isToday,
        isPast,
        isFuture,
        hasCompletedAny,
        hasCompletedAll,
        completedCount: dayLogs.length,
      });
    }
    return days;
  }, [todayStr, logs, totalHabits]);

  // SVG Circular progress radius & stroke math
  const radius = 28;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (completionPercentage / 100) * circumference;

  return (
    <div className="rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 sm:p-6 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Left Column: Greeting & Encouragement */}
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
              {greetingTime}, {name}
            </h2>
            <span className="text-lg" role="img" aria-label="sun">
              {hour < 18 ? '☀️' : '🌙'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#8D9793] leading-relaxed max-w-md">
            {getEncouragement()}
          </p>

          {/* Habit progress count indicator */}
          <div className="pt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {totalHabits === 0
                ? '0 active habits'
                : `${completedCount} of ${totalHabits} completed today`}
            </span>
          </div>
        </div>

        {/* Right Column: Daily Score Visual Progress Ring */}
        <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/60">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-[#707A75] mb-1">
              Daily Score
            </span>
            <div className="relative flex items-center justify-center">
              <svg className="w-18 h-18 -rotate-90 transform" viewBox="0 0 72 72">
                {/* Background Ring */}
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  className="stroke-neutral-100 dark:stroke-[#202A2E]"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Active Progress Ring */}
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  className="stroke-emerald-600 dark:stroke-emerald-400 transition-all duration-700 ease-out"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              {/* Score Value Inside Circle */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
                  {completionPercentage}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              {getScoreLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* Week Calendar Mini-Strip */}
      <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800/60">
        <div className="flex items-center justify-between gap-1 max-w-md mx-auto sm:mx-0">
          {weekStrip.map((day) => {
            const isDone = day.hasCompletedAny;
            return (
              <div
                key={day.dateStr}
                className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    day.isToday
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-neutral-400 dark:text-[#707A75]'
                  }`}
                >
                  {day.label}
                </span>

                {/* Day status indicator */}
                <div
                  className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center transition-all ${
                    isDone
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 shadow-2xs'
                      : day.isToday
                      ? 'border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                      : 'border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#202A2E]/40 text-neutral-300 dark:text-[#707A75]'
                  }`}
                  title={`${day.dateStr}: ${
                    isDone ? 'Completed' : day.isToday ? 'Today' : 'Not completed'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  ) : day.isToday ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  ) : (
                    <span className="text-[10px] font-mono text-neutral-400 dark:text-[#707A75]">
                      {day.dayNum}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
