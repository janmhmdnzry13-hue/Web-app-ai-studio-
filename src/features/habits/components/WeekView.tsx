import React from 'react';
import { Habit, HabitLog } from '../../../types/habit.types';
import { Check, Flame, ChevronLeft, ChevronRight, Calendar, Sparkles } from 'lucide-react';
import { getLocalDateString } from '../../../lib/dateUtils';

interface WeekViewProps {
  habits: readonly Habit[];
  logs: readonly HabitLog[];
  onToggleDay: (habitId: string, dateStr: string) => void;
  onOpenDetail: (habit: Habit) => void;
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({
  habits,
  logs,
  onToggleDay,
  onOpenDetail,
}: WeekViewProps) {
  const [weekOffset, setWeekOffset] = React.useState(0);

  const todayStr = getLocalDateString(new Date());

  // Generate 7 days for the selected week (Mon - Sun)
  const weekDays = React.useMemo(() => {
    const now = new Date();
    // Offset by weeks
    now.setDate(now.getDate() + weekOffset * 7);

    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = getLocalDateString(d);
      return {
        name: WEEKDAY_NAMES[idx],
        dateStr,
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      };
    });
  }, [weekOffset, todayStr]);

  const weekRangeLabel = `${weekDays[0].monthName} ${weekDays[0].dayNum} – ${weekDays[6].monthName} ${weekDays[6].dayNum}`;

  const activeHabits = habits.filter((h) => !h.isArchived);

  // Calculate overall weekly completion
  const totalWeeklyPossible = activeHabits.length * 7;
  const totalWeeklyCompleted = activeHabits.reduce((acc, h) => {
    const completedDays = weekDays.filter((d) =>
      logs.some((l) => l.habitId === h.id && l.date === d.dateStr && l.targetMet)
    ).length;
    return acc + completedDays;
  }, 0);

  const weeklyRate =
    totalWeeklyPossible > 0
      ? Math.round((totalWeeklyCompleted / totalWeeklyPossible) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Week Header & Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              Weekly Rhythm
            </h2>
            <p className="text-xs text-neutral-500 dark:text-[#8D9793]">
              {weekRangeLabel} • {weeklyRate}% consistency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="Previous week"
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#182024] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Current Week
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label="Next week"
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#182024] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Habit Weekly List (Mobile-Optimized Vertical Cards & Desktop Clean Table) */}
      <div className="space-y-3">
        {activeHabits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 text-center text-xs text-neutral-500">
            No active habits found for this week.
          </div>
        ) : (
          activeHabits.map((habit) => {
            const completedCount = weekDays.filter((d) =>
              logs.some((l) => l.habitId === habit.id && l.date === d.dateStr && l.targetMet)
            ).length;

            return (
              <div
                key={habit.id}
                className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-4 sm:p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => onOpenDetail(habit)}
                    className="min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6] truncate">
                        {habit.name}
                      </h3>
                      {habit.icon && <span className="text-sm">{habit.icon}</span>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-[#8D9793]">
                      {habit.category} • {completedCount}/7 days completed
                    </p>
                  </div>

                  {habit.streak?.currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {habit.streak.currentStreak}d
                    </span>
                  )}
                </div>

                {/* 7 Days Row */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                  {weekDays.map((d) => {
                    const isDone = logs.some(
                      (l) => l.habitId === habit.id && l.date === d.dateStr && l.targetMet
                    );

                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => onToggleDay(habit.id, d.dateStr)}
                        title={`${d.name} (${d.dateStr}): ${isDone ? 'Completed' : 'Not completed'}`}
                        aria-label={`${habit.name} on ${d.name} (${d.dateStr}): ${isDone ? 'Completed' : 'Not completed'}`}
                        className={`flex flex-col items-center justify-center py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer ${
                          isDone
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 font-bold shadow-2xs'
                            : d.isToday
                            ? 'border border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                            : 'bg-neutral-50 dark:bg-[#202A2E]/50 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-semibold">{d.name}</span>
                        <span className="text-xs font-mono mt-0.5">{d.dayNum}</span>
                        {isDone && <Check className="h-3 w-3 mt-0.5 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Forgiveness & Continuity Guidance */}
      <div className="rounded-2xl border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-white/60 dark:bg-[#182024]/60 p-4 flex items-center gap-3">
        <span className="text-lg shrink-0">🕊️</span>
        <p className="text-xs text-neutral-600 dark:text-[#8D9793] leading-relaxed">
          <strong>Forgive &amp; Move On:</strong> Missed a day earlier this week? No problem at all. Never allow a single missed day to create guilt—each morning provides a fresh opportunity.
        </p>
      </div>
    </div>
  );
}
