import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/task.service';
import { goalService } from '../../services/goal.service';
import { habitService, getTodayDateString, isDayExpectedForFrequency } from '../../services/habit.service';
import { financeService } from '../../services/finance.service';
import { emotionService } from '../../services/emotion.service';
import { relationshipService } from '../../services/relationship.service';
import { noteService } from '../../services/note.service';
import { insightService } from '../../services/insight.service';
import { Task } from '../../types/task.types';
import { Goal } from '../../types/goal.types';
import { Habit, HabitLog } from '../../types/habit.types';
import { MonthlyOverview } from '../../types/finance.types';
import { EmotionalReflection } from '../../types/emotion.types';
import { Relationship } from '../../types/relationship.types';
import { Note } from '../../types/note.types';
import { LifeInsight } from '../../types/insight.types';
import { SYSTEM_MODULES } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency } from '../../lib/utils';
import {
  ShieldCheck,
  Code2,
  Sliders,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  Activity,
  Terminal,
  LayoutDashboard,
  CheckSquare,
  Target,
  Repeat,
  Wallet,
  HeartHandshake,
  Users,
  FileText,
  Compass,
  Settings,
  Flame,
  Calendar,
  Clock,
  Plus,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Smile,
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
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
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
        relRes,
        notesRes,
        insRes,
      ] = await Promise.all([
        taskService.getTasks(user.id),
        goalService.getGoals(user.id),
        habitService.getHabits(user.id),
        habitService.getHabitLogs(user.id),
        financeService.getMonthlyOverview(user.id, currentMonthStr),
        emotionService.getReflections(user.id, { limit: 1 }),
        relationshipService.getRelationships(user.id),
        noteService.getNotes(user.id, { isArchived: false }),
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
      if (relRes.success && relRes.data) {
        setRelationships([...relRes.data]);
      }
      if (notesRes.success && notesRes.data) {
        setNotes([...notesRes.data]);
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

  const habitCompletionRate =
    expectedHabitsToday.length > 0
      ? Math.round((completedHabitsToday.length / expectedHabitsToday.length) * 100)
      : 0;

  const avgGoalProgress =
    activeGoals.length > 0
      ? Math.round(activeGoals.reduce((acc, g) => acc + g.progressPercentage, 0) / activeGoals.length)
      : 0;

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

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${user?.profile.displayName || 'Operator'}`}
        description="ORIGIN Sovereign Life OS — Real-time execution across tasks, habits, finances, reflection, and life horizons."
        badge={{ label: 'Phase 3 Fully Operational', variant: 'success' }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckSquare className="h-4 w-4" />}
              onClick={() => navigate('/app/tasks')}
            >
              Tasks
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Repeat className="h-4 w-4" />}
              onClick={() => navigate('/app/habits')}
            >
              Habits
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Wallet className="h-4 w-4" />}
              onClick={() => navigate('/app/finances')}
            >
              Finances
            </Button>
            <Button
              size="sm"
              leftIcon={<Compass className="h-4 w-4" />}
              onClick={() => navigate('/app/insights')}
            >
              Insights
            </Button>
          </div>
        }
      />

      {/* AI Co-Pilot Strategic Daily Planning & Intelligence Banner */}
      <Card className="p-5 bg-gradient-to-r from-purple-900/10 via-neutral-900/5 to-neutral-900/0 dark:from-purple-950/30 dark:via-neutral-900/40 dark:to-neutral-900/10 border-purple-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Sparkles className="h-5 w-5 text-purple-400 dark:text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  ORIGIN AI Co-Pilot & Daily Synthesis
                </h3>
                <Badge variant="primary" size="sm">Phase 4 Active</Badge>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Grounded in your {tasks.length} tasks, {habits.length} habits, {goals.length} goals, and financial logs.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/app/ai')}
            leftIcon={<Sparkles className="h-4 w-4 text-purple-400" />}
            className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shrink-0"
          >
            Launch AI Studio
          </Button>
        </div>

        {/* Quick Intelligence Triggers */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate('/app/ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
            <span>Plan My Day</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <Target className="h-3.5 w-3.5 text-purple-500" />
            <span>Break Down Goal</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <Repeat className="h-3.5 w-3.5 text-emerald-500" />
            <span>Habit Consistency Diagnosis</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <Wallet className="h-3.5 w-3.5 text-indigo-500" />
            <span>Monthly Financial Audit</span>
          </button>
        </div>
      </Card>

      {/* Live Operational Metrics Strip across Core Domains */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/tasks')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Tasks</span>
            <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {activeTasks.length}
          </p>
          <p className="text-[10px] text-neutral-500 truncate">
            {completedTasks.length} done this cycle
          </p>
        </Card>

        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/habits')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today&apos;s Rituals</span>
            <Repeat className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {completedHabitsToday.length} / {expectedHabitsToday.length}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {habitCompletionRate}% consistency
          </p>
        </Card>

        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/goals')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Horizons</span>
            <Target className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {activeGoals.length}
          </p>
          <p className="text-[10px] text-neutral-500 truncate">
            Avg progress: {avgGoalProgress}%
          </p>
        </Card>

        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/finances')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Net Cashflow</span>
            <Wallet className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p
            className={`text-xl font-bold ${
              (financeOverview?.netBalance || 0) >= 0 ? 'text-neutral-900 dark:text-neutral-100' : 'text-rose-500'
            }`}
          >
            {formatCurrency(financeOverview?.netBalance || 0)}
          </p>
          <p className="text-[10px] text-neutral-500 truncate">
            {financeOverview?.transactionCount || 0} transactions
          </p>
        </Card>

        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/emotions')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Emotional State</span>
            <Smile className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 capitalize truncate">
            {latestReflection?.primaryEmotion || (latestReflection ? `Mood ${latestReflection.mood}/5` : 'Unlogged')}
          </p>
          <p className="text-[10px] text-neutral-500">
            {latestReflection ? `Energy ${latestReflection.energy}/5 • Mood ${latestReflection.mood}/5` : 'Log today'}
          </p>
        </Card>

        <Card
          className="p-3.5 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-1"
          onClick={() => navigate('/app/notes')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Knowledge Base</span>
            <FileText className="h-3.5 w-3.5 text-teal-500" />
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {notes.length}
          </p>
          <p className="text-[10px] text-neutral-500 truncate">
            {relationships.length} contacts tracked
          </p>
        </Card>
      </div>

      {/* Main 2-Column Dashboard Feed: Today's Tasks & Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Immediate Task Stream */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Priority Tasks
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => navigate('/app/tasks')}
              >
                View All ({tasks.length})
              </Button>
            </div>

            <div className="space-y-2.5">
              {tasks.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center">
                  No active tasks. Create your first task to start organizing.
                </p>
              ) : (
                tasks.slice(0, 5).map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isDone
                          ? 'border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/20 opacity-60'
                          : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => handleQuickTaskToggle(task)}
                          aria-label={isDone ? `Mark task ${task.title} incomplete` : `Mark task ${task.title} complete`}
                          className="shrink-0 text-neutral-400 hover:text-emerald-500 cursor-pointer"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 fill-emerald-50 dark:fill-emerald-950" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium truncate ${
                            isDone ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigate('/app/tasks')}
            >
              New Task
            </Button>
          </div>
        </Card>

        {/* Right Column: Today's Habits Matrix */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Today&apos;s Habits & Cadence
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => navigate('/app/habits')}
              >
                View All ({habits.length})
              </Button>
            </div>

            <div className="space-y-2.5">
              {expectedHabitsToday.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center">
                  No habits scheduled for today. Establish your daily rituals.
                </p>
              ) : (
                expectedHabitsToday.slice(0, 5).map((habit) => {
                  const isDone = habitLogs.some(
                    (l) => l.habitId === habit.id && l.date === todayStr && l.targetMet
                  );

                  return (
                    <div
                      key={habit.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isDone
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={() => handleQuickHabitToggle(habit)}
                          aria-label={isDone ? `Mark habit ${habit.name} incomplete` : `Mark habit ${habit.name} complete`}
                          className="shrink-0 text-neutral-400 hover:text-emerald-500 cursor-pointer"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 fill-emerald-50 dark:fill-emerald-950" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium truncate ${
                            isDone ? 'text-neutral-900 dark:text-neutral-100 font-semibold' : 'text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {habit.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
                          <Flame className="h-3.5 w-3.5 fill-amber-500" />
                          <span>{habit.streak.currentStreak}d</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigate('/app/habits')}
            >
              New Habit
            </Button>
          </div>
        </Card>
      </div>

      {/* Cross-Domain Snapshot: Insights & Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Life Insights Summary */}
        <Card className="p-5 lg:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-purple-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Empirical Life Intelligence
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => navigate('/app/insights')}
              >
                Full Synthesis
              </Button>
            </div>

            {insights.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3">
                No synthesized insights yet. Continue recording tasks, habits, and financial logs to unlock empirical observations.
              </p>
            ) : (
              <div className="space-y-2.5">
                {insights.slice(0, 2).map((ins) => (
                  <div
                    key={ins.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">{ins.title}</span>
                      <Badge variant="subtle" size="sm" className="capitalize">
                        {ins.domain.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {ins.interpretation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => navigate('/app/insights')}
            >
              Explore Insights
            </Button>
          </div>
        </Card>

        {/* Quick Relationships Cadence Snapshot */}
        <Card className="p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Circle Cadences
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => navigate('/app/relationships')}
              >
                Contacts
              </Button>
            </div>

            {relationships.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3">
                No relationship cadences established yet.
              </p>
            ) : (
              <div className="space-y-2">
                {relationships.slice(0, 3).map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 text-xs"
                  >
                    <div>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100">{rel.name}</p>
                      <p className="text-[10px] text-neutral-400 capitalize">{rel.relationshipType.replace('_', ' ')}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-neutral-500">
                      {rel.nextReminder ? `Due ${rel.nextReminder}` : 'No date'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigate('/app/relationships')}
            >
              Add Contact
            </Button>
          </div>
        </Card>
      </div>

      {/* System Modules Directory */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              System Modules Directory
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Unified architecture integrating all life domains into one personal sovereign OS.
            </p>
          </div>
          <Badge variant="success" size="sm">
            Phase 3 All Modules Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYSTEM_MODULES.map((mod) => (
            <Card
              key={mod.id}
              className="group hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer flex flex-col justify-between"
              onClick={() => navigate(mod.path)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 group-hover:scale-105 transition-transform">
                    {iconMap[mod.iconName]}
                  </div>
                  <Badge variant="success" size="sm">
                    Operational
                  </Badge>
                </div>
                <CardTitle className="text-sm font-semibold mt-3">{mod.name}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {mod.description}
                </CardDescription>
              </CardHeader>

              <div className="p-5 pt-0 mt-auto flex items-center justify-between text-xs text-neutral-400 font-medium">
                <span className="font-mono text-[11px]">{mod.path}</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-neutral-700 dark:text-neutral-300" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
