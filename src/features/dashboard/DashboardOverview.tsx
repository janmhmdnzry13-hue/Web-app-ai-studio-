import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/task.service';
import { goalService } from '../../services/goal.service';
import { habitService, getTodayDateString, isDayExpectedForFrequency } from '../../services/habit.service';
import { financeService } from '../../services/finance.service';
import { emotionService } from '../../services/emotion.service';
import { insightService } from '../../services/insight.service';
import { Task } from '../../types/task.types';
import { Goal } from '../../types/goal.types';
import { Habit, HabitLog } from '../../types/habit.types';
import { MonthlyOverview } from '../../types/finance.types';
import { EmotionalReflection } from '../../types/emotion.types';
import { LifeInsight } from '../../types/insight.types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency } from '../../lib/utils';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  CheckSquare,
  Target,
  Repeat,
  Wallet,
  Compass,
  Flame,
  Plus,
  ArrowRight,
  Smile,
  PenTool,
  Heart,
  Calendar,
  Activity,
} from 'lucide-react';

export function DashboardOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [financeOverview, setFinanceOverview] = useState<MonthlyOverview | null>(null);
  const [latestReflection, setLatestReflection] = useState<EmotionalReflection | null>(null);
  const [insights, setInsights] = useState<LifeInsight[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const todayStr = getTodayDateString();

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const currentMonthStr = new Date().toISOString().substring(0, 7);
      const [
        tasksRes,
        goalsRes,
        habitsRes,
        logsRes,
        finRes,
        emotRes,
        insRes,
      ] = await Promise.all([
        taskService.getTasks(user.id),
        goalService.getGoals(user.id),
        habitService.getHabits(user.id),
        habitService.getHabitLogs(user.id),
        financeService.getMonthlyOverview(user.id, currentMonthStr),
        emotionService.getReflections(user.id, { limit: 1 }),
        insightService.generateLifeInsights(user.id),
      ]);

      if (tasksRes.success && tasksRes.data) {
        setTasks([...tasksRes.data.items]);
      }
      if (goalsRes.success && goalsRes.data) {
        setGoals([...goalsRes.data]);
      }
      if (habitsRes.success && habitsRes.data) {
        setHabits([...habitsRes.data]);
      }
      if (logsRes.success && logsRes.data) {
        setHabitLogs([...logsRes.data]);
      }
      if (finRes.success && finRes.data) {
        setFinanceOverview(finRes.data);
      }
      if (emotRes.success && emotRes.data && emotRes.data.length > 0) {
        setLatestReflection(emotRes.data[0]);
      }
      if (insRes.success && insRes.data) {
        setInsights([...insRes.data]);
      }
    } catch {
      error('Load Error', 'Failed to synchronize dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, error]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Quick 1-click task toggle right from dashboard
  const handleQuickTaskToggle = async (task: Task) => {
    if (!user?.id) return;
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    const res = await taskService.updateTask(user.id, task.id, { status: nextStatus });
    if (res.success && res.data) {
      if (nextStatus === 'completed') {
        success('Task Completed', `"${task.title}" completed.`);
      }
      loadDashboardData();
    }
  };

  // Quick 1-click habit toggle right from dashboard
  const handleQuickHabitToggle = async (habit: Habit) => {
    if (!user?.id) return;
    const isCompleted = habitLogs.some((l) => l.habitId === habit.id && l.date === todayStr && l.targetMet);

    if (isCompleted) {
      await habitService.unlogHabitCompletion(user.id, habit.id, todayStr);
      info('Habit Unmarked', `Unmarked "${habit.name}" for today.`);
    } else {
      await habitService.logHabitCompletion(user.id, habit.id, todayStr, habit.targetUnits);
      success('Habit Logged', `Completed "${habit.name}" today!`);
    }
    loadDashboardData();
  };

  // Computed metrics
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks]);
  const urgentTasks = useMemo(
    () => tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed'),
    [tasks]
  );
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.isArchived), [habits]);
  const expectedHabitsToday = useMemo(
    () =>
      activeHabits.filter((h) =>
        isDayExpectedForFrequency(todayStr, h.frequency, h.customDaysOfWeek)
      ),
    [activeHabits, todayStr]
  );
  const completedHabitsToday = useMemo(
    () =>
      expectedHabitsToday.filter((h) =>
        habitLogs.some((l) => l.habitId === h.id && l.date === todayStr && l.targetMet)
      ),
    [expectedHabitsToday, habitLogs, todayStr]
  );

  const habitRate =
    expectedHabitsToday.length > 0
      ? Math.round((completedHabitsToday.length / expectedHabitsToday.length) * 100)
      : 75;

  const taskRate =
    tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 80;

  const avgGoalProgress =
    activeGoals.length > 0
      ? Math.round(activeGoals.reduce((acc, g) => acc + g.progressPercentage, 0) / activeGoals.length)
      : 65;

  // Holistic Life Balance Score calculation
  const lifeScore = useMemo(() => {
    const weights = {
      habits: expectedHabitsToday.length > 0 ? habitRate : 80,
      tasks: tasks.length > 0 ? taskRate : 75,
      goals: avgGoalProgress,
      wellness: latestReflection ? Math.round((latestReflection.mood / 5) * 100) : 85,
    };
    return Math.round((weights.habits * 0.3) + (weights.tasks * 0.3) + (weights.goals * 0.2) + (weights.wellness * 0.2));
  }, [expectedHabitsToday.length, habitRate, tasks.length, taskRate, avgGoalProgress, latestReflection]);

  // Greeting by time of day
  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200 max-w-6xl mx-auto pb-12">
      {/* 1. EDITORIAL HERO SECTION */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#707A75] dark:text-[#8D9793]">
            {formattedDate}
          </span>
          <div className="flex-1 h-px bg-neutral-200/80 dark:bg-[rgba(240,238,230,0.08)]" />
          <span className="text-xs text-neutral-400 dark:text-[#707A75] font-serif italic hidden sm:inline">
            ORIGIN OS • Clarity & Balance
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div>
            <h1 className="font-serif italic text-3xl sm:text-4xl text-neutral-900 dark:text-[#F0EEE6] tracking-tight leading-tight">
              Good {timeOfDay},{' '}
              <span className="font-semibold not-italic text-[#D9822B] dark:text-[#E3A857]">
                {user?.profile.displayName || 'Friend'}
              </span>
              .
            </h1>
            <p className="text-sm text-neutral-600 dark:text-[#8D9793] mt-1.5 max-w-xl font-normal leading-relaxed">
              {activeTasks.length > 0
                ? `${activeTasks.length} ${activeTasks.length === 1 ? 'task' : 'tasks'} scheduled today • ${completedHabitsToday.length} of ${expectedHabitsToday.length} rituals completed. Steady focus ahead.`
                : 'All primary actions clear. Your life operating space is serene and harmonized.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigate('/app/tasks')}
              className="rounded-full bg-white/70 dark:bg-[#182024]/70 border-neutral-200/80 dark:border-[rgba(240,238,230,0.12)] text-xs"
            >
              New Task
            </Button>
            <Button
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5 text-[#E3A857]" />}
              onClick={() => navigate('/app/ai')}
              className="rounded-full bg-neutral-900 text-white dark:bg-[#F0EEE6] dark:text-[#10161A] hover:bg-neutral-800 text-xs shadow-xs"
            >
              AI Co-Pilot
            </Button>
          </div>
        </div>
      </section>

      {/* 2. LIFE SCORE RING & BALANCE PILLARS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Overall Life Score Widget */}
        <div className="lg:col-span-5 rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#707A75] dark:text-[#8D9793]">
                SYSTEM METRIC
              </div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
                Life Balance Index
              </h2>
            </div>
            <Badge variant="subtle" size="sm" className="bg-[#FAF8F5] dark:bg-[#10161A] text-xs font-mono">
              Live Index
            </Badge>
          </div>

          <div className="flex items-center justify-around py-2">
            {/* SVG Circular Dial */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="stroke-neutral-200/60 dark:stroke-[#202A2E]"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  stroke="url(#lifeGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - lifeScore / 100)}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="lifeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E3A857" />
                    <stop offset="50%" stopColor="#C97F5C" />
                    <stop offset="100%" stopColor="#57ABA0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="font-serif text-3xl font-bold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
                  {lifeScore}
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#707A75] dark:text-[#8D9793]">
                  / 100
                </span>
              </div>
            </div>

            {/* Score Context */}
            <div className="space-y-2 max-w-[140px]">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#57ABA0]/10 text-[#57ABA0]">
                <Activity className="h-3 w-3" />
                <span>Harmonized</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-[#8D9793] leading-snug">
                Your momentum across focus, rituals, and wellness is in steady equilibrium.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between text-xs text-neutral-500 dark:text-[#707A75]">
            <span>Calculated from 4 core domains</span>
            <span className="font-mono text-[11px] text-[#D9822B] dark:text-[#E3A857]">Balanced</span>
          </div>
        </div>

        {/* Right: 4 Pillar Breakdown Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-3.5">
          {/* Pillar 1: Focus & Tasks (Clay) */}
          <div
            onClick={() => navigate('/app/tasks')}
            className="p-4 rounded-2xl bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] hover:border-[#C97F5C]/50 dark:hover:border-[#C97F5C]/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-lg bg-[#C97F5C]/10 text-[#C97F5C] flex items-center justify-center">
                <CheckSquare className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#707A75]">
                {completedTasks.length}/{tasks.length}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8D9793]">Focus & Action</div>
              <div className="font-serif text-2xl font-semibold text-neutral-900 dark:text-[#F0EEE6] mt-0.5">
                {activeTasks.length} <span className="text-xs font-normal text-neutral-400 font-sans">pending</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-[#202A2E] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${taskRate}%`, backgroundColor: '#C97F5C' }}
                />
              </div>
            </div>
          </div>

          {/* Pillar 2: Daily Rituals (Amber) */}
          <div
            onClick={() => navigate('/app/habits')}
            className="p-4 rounded-2xl bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] hover:border-[#E3A857]/50 dark:hover:border-[#E3A857]/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-lg bg-[#E3A857]/10 text-[#D9822B] dark:text-[#E3A857] flex items-center justify-center">
                <Repeat className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#707A75]">
                {completedHabitsToday.length}/{expectedHabitsToday.length}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8D9793]">Daily Rituals</div>
              <div className="font-serif text-2xl font-semibold text-neutral-900 dark:text-[#F0EEE6] mt-0.5">
                {habitRate}% <span className="text-xs font-normal text-neutral-400 font-sans">done today</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-[#202A2E] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${habitRate}%`, backgroundColor: '#E3A857' }}
                />
              </div>
            </div>
          </div>

          {/* Pillar 3: Cash Flow (Teal) */}
          <div
            onClick={() => navigate('/app/finances')}
            className="p-4 rounded-2xl bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] hover:border-[#57ABA0]/50 dark:hover:border-[#57ABA0]/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-lg bg-[#57ABA0]/10 text-[#57ABA0] flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#707A75]">
                Monthly
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8D9793]">Monthly Net</div>
              <div className="font-serif text-2xl font-semibold text-neutral-900 dark:text-[#F0EEE6] mt-0.5 truncate">
                {formatCurrency(financeOverview?.netBalance || 0)}
              </div>
              <div className="w-full bg-neutral-100 dark:bg-[#202A2E] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(20, ((financeOverview?.totalIncome || 1) / ((financeOverview?.totalExpense || 1) + 1)) * 50))}%`,
                    backgroundColor: '#57ABA0',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Pillar 4: Life Horizons (Sage) */}
          <div
            onClick={() => navigate('/app/goals')}
            className="p-4 rounded-2xl bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] hover:border-[#93AC78]/50 dark:hover:border-[#93AC78]/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <div className="h-7 w-7 rounded-lg bg-[#93AC78]/10 text-[#93AC78] flex items-center justify-center">
                <Target className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#707A75]">
                {activeGoals.length} active
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-[#8D9793]">Horizons & Goals</div>
              <div className="font-serif text-2xl font-semibold text-neutral-900 dark:text-[#F0EEE6] mt-0.5">
                {avgGoalProgress}% <span className="text-xs font-normal text-neutral-400 font-sans">avg track</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-[#202A2E] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${avgGoalProgress}%`, backgroundColor: '#93AC78' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TODAY'S FOCUS & QUICK ACTION TILES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Featured Today's Focus Card */}
        <div className="lg:col-span-7 rounded-2xl p-6 bg-gradient-to-br from-neutral-900 to-neutral-950 text-white dark:from-[#182024] dark:to-[#10161A] border border-neutral-800 dark:border-[rgba(240,238,230,0.1)] relative overflow-hidden shadow-sm flex flex-col justify-between">
          {/* Subtle Ambient Glow */}
          <div
            className="absolute top-0 right-0 w-64 h-64 pointer-events-none rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #E3A857 0%, transparent 70%)' }}
          />

          <div className="space-y-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#E3A857] animate-pulse" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#E3A857]">
                TODAY&apos;S FOCUS
              </span>
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl text-[#F0EEE6] font-normal leading-snug">
              {urgentTasks.length > 0
                ? `Resolve ${urgentTasks[0].title}`
                : activeTasks.length > 0
                ? `Progress ${activeTasks[0].title}`
                : 'Dedicated deep work & reflective pause'}
            </h3>

            <p className="text-xs text-neutral-300 dark:text-[#8D9793] leading-relaxed max-w-md">
              {urgentTasks.length > 0
                ? `You marked an urgent priority requiring attention. Complete it first before taking on secondary tasks.`
                : activeTasks.length > 0
                ? `Steady focus yields continuous progress. Begin with your highest impact initiative today.`
                : `You are fully caught up on priority items. Take time for planning or restful contemplation.`}
            </p>
          </div>

          <div className="pt-5 mt-4 border-t border-neutral-800 dark:border-[rgba(240,238,230,0.08)] flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-[#707A75]">
              <Flame className="h-3.5 w-3.5 text-[#E3A857]" />
              <span>
                {completedHabitsToday.length > 0
                  ? `${completedHabitsToday.length} ritual completed`
                  : 'Rituals ready to begin'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/tasks')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E3A857] text-[#10161A] text-xs font-semibold hover:bg-[#D9822B] transition-colors cursor-pointer"
            >
              <span>{activeTasks.length > 0 ? 'Execute Focus' : 'Explore Tasks'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="lg:col-span-5 rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#707A75] dark:text-[#8D9793]">
              FAST CAPTURE
            </div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight mt-0.5">
              Quick Intentions
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-3">
            <button
              type="button"
              onClick={() => navigate('/app/notes')}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-[#202A2E]/50 hover:bg-[#FAF8F5] dark:hover:bg-[#202A2E] border border-neutral-200/50 dark:border-[rgba(240,238,230,0.06)] text-left transition-all cursor-pointer group"
            >
              <div className="h-7 w-7 rounded-lg bg-[#C97F5C]/10 text-[#C97F5C] flex items-center justify-center shrink-0">
                <PenTool className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">Capture Note</div>
                <div className="text-[10px] text-neutral-400 dark:text-[#707A75]">Write thought</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/tasks')}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-[#202A2E]/50 hover:bg-[#FAF8F5] dark:hover:bg-[#202A2E] border border-neutral-200/50 dark:border-[rgba(240,238,230,0.06)] text-left transition-all cursor-pointer group"
            >
              <div className="h-7 w-7 rounded-lg bg-[#E3A857]/10 text-[#D9822B] dark:text-[#E3A857] flex items-center justify-center shrink-0">
                <CheckSquare className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">Add Task</div>
                <div className="text-[10px] text-neutral-400 dark:text-[#707A75]">New action</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/finances')}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-[#202A2E]/50 hover:bg-[#FAF8F5] dark:hover:bg-[#202A2E] border border-neutral-200/50 dark:border-[rgba(240,238,230,0.06)] text-left transition-all cursor-pointer group"
            >
              <div className="h-7 w-7 rounded-lg bg-[#57ABA0]/10 text-[#57ABA0] flex items-center justify-center shrink-0">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">Log Cash</div>
                <div className="text-[10px] text-neutral-400 dark:text-[#707A75]">Expense / income</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/emotions')}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-[#202A2E]/50 hover:bg-[#FAF8F5] dark:hover:bg-[#202A2E] border border-neutral-200/50 dark:border-[rgba(240,238,230,0.06)] text-left transition-all cursor-pointer group"
            >
              <div className="h-7 w-7 rounded-lg bg-[#93AC78]/10 text-[#93AC78] flex items-center justify-center shrink-0">
                <Smile className="h-3.5 w-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">Check-in</div>
                <div className="text-[10px] text-neutral-400 dark:text-[#707A75]">Mood & energy</div>
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between text-xs text-neutral-400 dark:text-[#707A75]">
            <span>Press ⌘K for Command Center</span>
            <span className="font-mono text-[10px]">Instant</span>
          </div>
        </div>
      </section>

      {/* 4. MAIN FEED: PRIORITY TASKS & DAILY RITUALS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Priority Tasks */}
        <div className="rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[#C97F5C]/10 text-[#C97F5C] flex items-center justify-center">
                  <CheckSquare className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                    Today&apos;s Priority Actions
                  </h3>
                  <p className="text-[11px] text-neutral-400 dark:text-[#707A75]">
                    {activeTasks.length} active of {tasks.length} total
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-[#8D9793] dark:hover:text-[#F0EEE6]"
                onClick={() => navigate('/app/tasks')}
              >
                View all ({tasks.length})
              </Button>
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-neutral-200/80 dark:border-neutral-800 rounded-xl space-y-2">
                  <p className="text-xs text-neutral-400 dark:text-[#707A75]">
                    No active tasks scheduled.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-full"
                    onClick={() => navigate('/app/tasks')}
                  >
                    Create Task
                  </Button>
                </div>
              ) : (
                tasks.slice(0, 5).map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-150 ${
                        isDone
                          ? 'border-neutral-100 dark:border-[rgba(240,238,230,0.04)] bg-neutral-50/40 dark:bg-[#10161A]/30 opacity-55'
                          : 'border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#182024] hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => handleQuickTaskToggle(task)}
                          aria-label={isDone ? `Mark task ${task.title} incomplete` : `Mark task ${task.title} complete`}
                          className="shrink-0 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950" />
                          ) : (
                            <Circle className="h-4 w-4 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500" />
                          )}
                        </button>
                        <span
                          className={`text-xs truncate ${
                            isDone ? 'line-through text-neutral-400 dark:text-[#707A75]' : 'text-neutral-900 dark:text-[#F0EEE6] font-medium'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.priority === 'urgent' && (
                          <Badge variant="danger" size="sm">
                            Urgent
                          </Badge>
                        )}
                        {task.priority === 'high' && (
                          <Badge variant="warning" size="sm">
                            High
                          </Badge>
                        )}
                        {task.dueDate && (
                          <span className="text-[10px] text-neutral-400 dark:text-[#707A75] hidden sm:inline font-mono">
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between">
            <span className="text-[11px] text-neutral-400 dark:text-[#707A75]">
              {activeTasks.length} pending actions
            </span>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3 w-3" />}
              onClick={() => navigate('/app/tasks')}
              className="rounded-full text-xs"
            >
              Add Task
            </Button>
          </div>
        </div>

        {/* Right Column: Today's Habits */}
        <div className="rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[#E3A857]/10 text-[#D9822B] dark:text-[#E3A857] flex items-center justify-center">
                  <Repeat className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                    Daily Rituals & Habits
                  </h3>
                  <p className="text-[11px] text-neutral-400 dark:text-[#707A75]">
                    {completedHabitsToday.length} of {expectedHabitsToday.length} completed
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-[#8D9793] dark:hover:text-[#F0EEE6]"
                onClick={() => navigate('/app/habits')}
              >
                View all ({habits.length})
              </Button>
            </div>

            <div className="space-y-2">
              {expectedHabitsToday.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-neutral-200/80 dark:border-neutral-800 rounded-xl space-y-2">
                  <p className="text-xs text-neutral-400 dark:text-[#707A75]">
                    No rituals scheduled for today.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-full"
                    onClick={() => navigate('/app/habits')}
                  >
                    Set Daily Ritual
                  </Button>
                </div>
              ) : (
                expectedHabitsToday.slice(0, 5).map((habit) => {
                  const isDone = habitLogs.some(
                    (l) => l.habitId === habit.id && l.date === todayStr && l.targetMet
                  );

                  return (
                    <div
                      key={habit.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-150 ${
                        isDone
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#182024] hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => handleQuickHabitToggle(habit)}
                          aria-label={isDone ? `Mark habit ${habit.name} incomplete` : `Mark habit ${habit.name} complete`}
                          className="shrink-0 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950" />
                          ) : (
                            <Circle className="h-4 w-4 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500" />
                          )}
                        </button>
                        <span
                          className={`text-xs truncate ${
                            isDone ? 'text-neutral-900 dark:text-[#F0EEE6] font-semibold' : 'text-neutral-800 dark:text-[#8D9793] font-medium'
                          }`}
                        >
                          {habit.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-[11px] text-[#D9822B] dark:text-[#E3A857] font-medium bg-[#E3A857]/10 px-2 py-0.5 rounded-md">
                          <Flame className="h-3 w-3 fill-[#E3A857] text-[#E3A857]" />
                          <span>{habit.streak.currentStreak}d</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between">
            <span className="text-[11px] text-neutral-400 dark:text-[#707A75]">
              {habitRate}% completion rate
            </span>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3 w-3" />}
              onClick={() => navigate('/app/habits')}
              className="rounded-full text-xs"
            >
              Add Habit
            </Button>
          </div>
        </div>
      </section>

      {/* 5. DOMAIN INSIGHTS & REFLECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Life Insights */}
        <div className="lg:col-span-2 rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Compass className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                    Life Synthesis & Observations
                  </h3>
                  <p className="text-[11px] text-neutral-400 dark:text-[#707A75]">
                    Dynamic intelligence grounded in your active telemetry
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-[#8D9793] dark:hover:text-[#F0EEE6]"
                onClick={() => navigate('/app/insights')}
              >
                View all
              </Button>
            </div>

            {insights.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-[#707A75] py-4">
                Insights will automatically appear as you complete tasks, habits, and financial logs.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.slice(0, 2).map((ins) => (
                  <div
                    key={ins.id}
                    className="p-4 rounded-xl bg-neutral-50/70 dark:bg-[#202A2E]/40 border border-neutral-200/60 dark:border-[rgba(240,238,230,0.06)] space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-[#F0EEE6] truncate">{ins.title}</span>
                      <Badge variant="subtle" size="sm" className="capitalize shrink-0 text-[10px]">
                        {ins.domain.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-neutral-600 dark:text-[#8D9793] line-clamp-3 leading-relaxed text-[11px]">
                      {ins.interpretation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between">
            <span className="text-[11px] text-neutral-400 dark:text-[#707A75]">
              Cross-domain pattern engine
            </span>
            <Button
              size="sm"
              variant="outline"
              rightIcon={<ArrowRight className="h-3 w-3" />}
              onClick={() => navigate('/app/insights')}
              className="rounded-full text-xs"
            >
              Full Synthesis
            </Button>
          </div>
        </div>

        {/* Daily Reflection / Emotional Check-in */}
        <div className="rounded-2xl p-6 bg-white/80 dark:bg-[#182024]/90 border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[#93AC78]/10 text-[#93AC78] flex items-center justify-center">
                  <Smile className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                    Emotional Equilibrium
                  </h3>
                  <p className="text-[11px] text-neutral-400 dark:text-[#707A75]">
                    Mindfulness & energy check
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-[#8D9793] dark:hover:text-[#F0EEE6]"
                onClick={() => navigate('/app/emotions')}
              >
                Journal
              </Button>
            </div>

            {latestReflection ? (
              <div className="p-4 rounded-xl bg-neutral-50/70 dark:bg-[#202A2E]/40 border border-neutral-200/60 dark:border-[rgba(240,238,230,0.06)] space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-neutral-900 dark:text-[#F0EEE6]">
                    {latestReflection.primaryEmotion}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-[#707A75] font-mono">
                    {latestReflection.date}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-[#8D9793]">
                  <span>Energy: <strong className="text-neutral-900 dark:text-[#F0EEE6]">{latestReflection.energy}/5</strong></span>
                  <span>Mood: <strong className="text-neutral-900 dark:text-[#F0EEE6]">{latestReflection.mood}/5</strong></span>
                </div>
                {(latestReflection.reflection || latestReflection.journalEntry) && (
                  <p className="text-[11px] text-neutral-500 dark:text-[#8D9793] line-clamp-2 italic font-serif">
                    &ldquo;{latestReflection.reflection || latestReflection.journalEntry}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-neutral-50/50 dark:bg-[#202A2E]/20 border border-neutral-200/60 dark:border-[rgba(240,238,230,0.06)] text-center py-6 space-y-1">
                <p className="text-xs text-neutral-400 dark:text-[#707A75]">
                  No check-in recorded for today yet.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/app/emotions')}
              className="rounded-full text-xs"
            >
              {latestReflection ? 'New Reflection' : 'Check In'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
