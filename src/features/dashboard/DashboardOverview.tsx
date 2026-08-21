import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/task.service';
import { goalService } from '../../services/goal.service';
import { habitService, getTodayDateString, isDayExpectedForFrequency } from '../../services/habit.service';
import { Task } from '../../types/task.types';
import { Goal } from '../../types/goal.types';
import { Habit, HabitLog } from '../../types/habit.types';
import { SYSTEM_MODULES } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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
} from 'lucide-react';

export function DashboardOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const todayStr = getTodayDateString();

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [tasksRes, goalsRes, habitsRes, logsRes] = await Promise.all([
        taskService.getTasks(user.id),
        goalService.getGoals(user.id),
        habitService.getHabits(user.id),
        habitService.getHabitLogs(user.id),
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
        description="ORIGIN Life Operating System — Real-time execution across tasks, habits, and life horizons."
        badge={{ label: 'Phase 2 Live Core', variant: 'success' }}
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
              size="sm"
              leftIcon={<Target className="h-4 w-4" />}
              onClick={() => navigate('/app/goals')}
            >
              Goals
            </Button>
          </div>
        }
      />

      {/* Live Operational Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className="p-4 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
          onClick={() => navigate('/app/tasks')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Tasks</span>
            <CheckSquare className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {activeTasks.length}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {completedTasks.length} completed this cycle
          </p>
        </Card>

        <Card
          className="p-4 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
          onClick={() => navigate('/app/habits')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Cadence</span>
            <Repeat className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {completedHabitsToday.length} / {expectedHabitsToday.length}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            {habitCompletionRate}% consistency rate
          </p>
        </Card>

        <Card
          className="p-4 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
          onClick={() => navigate('/app/goals')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Horizons</span>
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {activeGoals.length}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Avg completion: {avgGoalProgress}%
          </p>
        </Card>

        <Card
          className="p-4 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
          onClick={() => navigate('/app/tasks')}
        >
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Urgent Focus</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {urgentTasks.length}
          </p>
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
            Requires immediate focus
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

      {/* Active Horizons & Goals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Active Life Horizons & Objectives
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Long-range direction driving daily habits and priorities.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => navigate('/app/goals')}
          >
            Manage Goals
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeGoals.slice(0, 3).map((goal) => (
            <Card
              key={goal.id}
              className="p-5 space-y-3 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
              onClick={() => navigate('/app/goals')}
            >
              <div className="flex items-center justify-between">
                <Badge variant="subtle" size="sm" className="capitalize">
                  {goal.category.replace('_', ' ')}
                </Badge>
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {goal.progressPercentage}%
                </span>
              </div>

              <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                {goal.title}
              </h4>

              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-neutral-900 dark:bg-neutral-100 h-full transition-all duration-300"
                  style={{ width: `${goal.progressPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>{goal.milestones.filter((m) => m.isCompleted).length}/{goal.milestones.length} milestones</span>
                <span>{goal.targetDate.split('T')[0]}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* System Modules Navigator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              System Modules
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Unified architecture integrating all domains into one personal life OS.
            </p>
          </div>
          <Badge variant="outline" size="sm">
            Phase 2 Core Active
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
                  <Badge
                    variant={['tasks', 'goals', 'habits'].includes(mod.id) ? 'success' : 'subtle'}
                    size="sm"
                  >
                    {['tasks', 'goals', 'habits'].includes(mod.id) ? 'Active Core' : 'Phase 2 Staging'}
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
