import React from 'react';
import { Habit, HabitLog } from '../../../types/habit.types';
import {
  Sparkles,
  TrendingUp,
  Award,
  Clock,
  Calendar,
  Flame,
  CheckCircle2,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { getLocalDateString } from '../../../lib/dateUtils';

interface InsightsViewProps {
  habits: readonly Habit[];
  logs: readonly HabitLog[];
}

export function InsightsView({ habits, logs }: InsightsViewProps) {
  const activeHabits = habits.filter((h) => !h.isArchived);
  const metLogs = logs.filter((l) => l.targetMet);

  const hasEnoughData = metLogs.length >= 3;

  // 1. Overall Consistency in last 30 days
  const thirtyDaysStats = React.useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(getLocalDateString(d));
    }

    const totalDays = 30;
    const totalPossible = activeHabits.length * totalDays;
    const completedInRange = logs.filter(
      (l) => l.targetMet && days.includes(l.date)
    ).length;

    const rate =
      totalPossible > 0 ? Math.round((completedInRange / totalPossible) * 100) : 0;

    return { totalDays, completedInRange, rate };
  }, [activeHabits.length, logs]);

  // 2. Best Time of Day
  const timeOfDayStats = React.useMemo(() => {
    const counts: Record<string, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      anytime: 0,
    };

    activeHabits.forEach((h) => {
      const habitLogs = metLogs.filter((l) => l.habitId === h.id);
      counts[h.timeOfDay] = (counts[h.timeOfDay] || 0) + habitLogs.length;
    });

    let bestTime = 'morning';
    let max = -1;
    Object.entries(counts).forEach(([t, count]) => {
      if (count > max) {
        max = count;
        bestTime = t;
      }
    });

    return { counts, bestTime, max };
  }, [activeHabits, metLogs]);

  // 3. Weekly Trends (Last 4 Weeks)
  const weeklyTrends = React.useMemo(() => {
    const weeks = [];
    const today = new Date();
    for (let w = 3; w >= 0; w--) {
      const start = new Date(today);
      start.setDate(today.getDate() - (w * 7 + 6));
      const end = new Date(today);
      end.setDate(today.getDate() - w * 7);

      const startStr = getLocalDateString(start);
      const endStr = getLocalDateString(end);

      const weekLogs = logs.filter(
        (l) => l.targetMet && l.date >= startStr && l.date <= endStr
      );
      const possible = activeHabits.length * 7;
      const rate = possible > 0 ? Math.min(100, Math.round((weekLogs.length / possible) * 100)) : 0;

      weeks.push({
        label: w === 0 ? 'This Week' : `${w}w ago`,
        completed: weekLogs.length,
        rate,
      });
    }
    return weeks;
  }, [activeHabits.length, logs]);

  // 4. Category Breakdown
  const categoryBreakdown = React.useMemo(() => {
    const categories: Record<string, { count: number; completions: number }> = {};
    activeHabits.forEach((h) => {
      if (!categories[h.category]) {
        categories[h.category] = { count: 0, completions: 0 };
      }
      categories[h.category].count += 1;
      categories[h.category].completions += metLogs.filter((l) => l.habitId === h.id).length;
    });
    return Object.entries(categories).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [activeHabits, metLogs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              Habit Insights &amp; Patterns
            </h2>
            <p className="text-xs text-neutral-500 dark:text-[#8D9793]">
              Real data reflections on your daily cadence and compound growth
            </p>
          </div>
        </div>

        <div className="text-right sm:text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Total Check-ins
          </span>
          <p className="text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
            {metLogs.length}
          </p>
        </div>
      </div>

      {!hasEnoughData ? (
        /* Sparse data state */
        <div className="rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 p-8 sm:p-12 text-center space-y-4 bg-white/40 dark:bg-[#182024]/40">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              Keep tracking to discover patterns
            </h3>
            <p className="text-xs text-neutral-500 dark:text-[#8D9793] leading-relaxed">
              As you complete habits over your first few days, ORIGIN will calculate your consistency rate, time of day preferences, and weekly rhythm trends.
            </p>
          </div>
        </div>
      ) : (
        /* Real Insights Dashboard */
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  30-Day Consistency
                </span>
                <Award className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
                {thirtyDaysStats.rate}%
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-[#8D9793]">
                {thirtyDaysStats.completedInRange} check-ins in the past 30 days
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Peak Cadence Window
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6] capitalize">
                {timeOfDayStats.bestTime}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-[#8D9793]">
                Most consistent execution time
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Active Cadences
                </span>
                <CheckCircle2 className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
                {activeHabits.length}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-[#8D9793]">
                Spanning {categoryBreakdown.length} life domains
              </p>
            </div>
          </div>

          {/* Weekly Progress Trend Bar Chart */}
          <div className="rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                  Weekly Consistency Trends (Last 4 Weeks)
                </h3>
              </div>
              <span className="text-xs text-neutral-400">Completion %</span>
            </div>

            <div className="grid grid-cols-4 gap-3 pt-2">
              {weeklyTrends.map((w, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div className="w-full bg-neutral-100 dark:bg-[#202A2E] rounded-xl h-24 flex flex-col justify-end p-1 overflow-hidden">
                    <div
                      className="w-full bg-emerald-500 dark:bg-emerald-400 rounded-lg transition-all duration-500"
                      style={{ height: `${Math.max(8, w.rate)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
                    {w.rate}%
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-[#707A75] uppercase">
                    {w.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Categories Breakdown */}
          <div className="rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/90 dark:bg-[#182024]/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                Life Domains &amp; Categories
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categoryBreakdown.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#202A2E]/30 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                      {cat.name}
                    </h4>
                    <p className="text-[10px] text-neutral-400">
                      {cat.count} {cat.count === 1 ? 'habit' : 'habits'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cat.completions}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">check-ins</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
