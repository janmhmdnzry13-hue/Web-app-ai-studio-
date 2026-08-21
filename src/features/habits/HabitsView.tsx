import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { habitService } from '../../services/habit.service';
import {
  Habit,
  HabitFrequency,
  HabitTimeOfDay,
  HabitLog,
  CreateHabitDTO,
} from '../../types/habit.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Flame,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Sparkles,
  Trash2,
  Edit2,
  Activity,
  Award,
  Clock,
} from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HabitsView() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<HabitFrequency | 'all'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formRoutine, setFormRoutine] = useState('');
  const [formCue, setFormCue] = useState('');
  const [formReward, setFormReward] = useState('');
  const [formCategory, setFormCategory] = useState('Health & Vitality');
  const [formFrequency, setFormFrequency] = useState<HabitFrequency>('daily');
  const [formTimeOfDay, setFormTimeOfDay] = useState<HabitTimeOfDay>('morning');
  const [formTargetUnits, setFormTargetUnits] = useState('1');
  const [formUnitLabel, setFormUnitLabel] = useState('session');
  const [formCustomDays, setFormCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 7-day Matrix Reference Dates (Past 6 days + Today)
  const dateColumns = useMemo(() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = WEEKDAYS[d.getDay()];
      const isToday = i === 0;
      dates.push({ dateStr, dayName, dayNum: d.getDate(), isToday });
    }
    return dates;
  }, []);

  // Load Habits and Logs
  const loadHabitsAndLogs = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        habitService.getHabits(user.id),
        habitService.getHabitLogs(user.id),
      ]);

      if (habitsRes.success && habitsRes.data) {
        let filtered = [...habitsRes.data];
        if (categoryFilter !== 'all') {
          filtered = filtered.filter((h) => h.category === categoryFilter);
        }
        if (frequencyFilter !== 'all') {
          filtered = filtered.filter((h) => h.frequency === frequencyFilter);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (h) =>
              h.name.toLowerCase().includes(q) ||
              h.routine.toLowerCase().includes(q) ||
              h.cue?.toLowerCase().includes(q)
          );
        }
        setHabits(filtered);
      }

      if (logsRes.success && logsRes.data) {
        setLogs([...logsRes.data]);
      }
    } catch {
      error('Load Error', 'Failed to retrieve habits and cadence logs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, categoryFilter, frequencyFilter, searchQuery, error]);

  useEffect(() => {
    loadHabitsAndLogs();
  }, [loadHabitsAndLogs]);

  // Overall Habit Stats
  const stats = useMemo(() => {
    const total = habits.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCompletedCount = habits.filter((h) =>
      logs.some((l) => l.habitId === h.id && l.date === todayStr && l.targetMet)
    ).length;
    const maxStreak = total > 0 ? Math.max(...habits.map((h) => h.streak.currentStreak), 0) : 0;
    const totalMetLogs = logs.filter((l) => l.targetMet).length;

    return { total, todayCompletedCount, maxStreak, totalMetLogs };
  }, [habits, logs]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingHabit(null);
    setFormName('');
    setFormRoutine('');
    setFormCue('');
    setFormReward('');
    setFormCategory('Health & Vitality');
    setFormFrequency('daily');
    setFormTimeOfDay('morning');
    setFormTargetUnits('1');
    setFormUnitLabel('session');
    setFormCustomDays([1, 2, 3, 4, 5]);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormName(habit.name);
    setFormRoutine(habit.routine);
    setFormCue(habit.cue || '');
    setFormReward(habit.reward || '');
    setFormCategory(habit.category);
    setFormFrequency(habit.frequency);
    setFormTimeOfDay(habit.timeOfDay);
    setFormTargetUnits(String(habit.targetUnits || 1));
    setFormUnitLabel(habit.unitLabel || 'session');
    setFormCustomDays(habit.customDaysOfWeek ? [...habit.customDaysOfWeek] : [1, 2, 3, 4, 5]);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Save Habit
  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormErrors({ name: 'Habit name is required.' });
      return;
    }
    if (!formRoutine.trim()) {
      setFormErrors({ routine: 'Habit routine/action is required.' });
      return;
    }
    if (!user?.id) return;

    try {
      if (editingHabit) {
        const updatePayload: Partial<Habit> = {
          name: formName.trim(),
          routine: formRoutine.trim(),
          cue: formCue.trim(),
          reward: formReward.trim(),
          category: formCategory,
          frequency: formFrequency,
          timeOfDay: formTimeOfDay,
          targetUnits: parseFloat(formTargetUnits) || 1,
          unitLabel: formUnitLabel.trim() || 'session',
          customDaysOfWeek: formFrequency === 'custom' ? formCustomDays : undefined,
        };

        const res = await habitService.updateHabit(user.id, editingHabit.id, updatePayload);
        if (res.success && res.data) {
          success('Habit Updated', `"${res.data.name}" updated.`);
          setIsCreateModalOpen(false);
          loadHabitsAndLogs();
        } else {
          error('Update Failed', res.error?.message || 'Unable to update habit');
        }
      } else {
        const createDTO: CreateHabitDTO = {
          name: formName.trim(),
          routine: formRoutine.trim(),
          category: formCategory,
          frequency: formFrequency,
          timeOfDay: formTimeOfDay,
          targetUnits: parseFloat(formTargetUnits) || 1,
          unitLabel: formUnitLabel.trim() || 'session',
        };

        const res = await habitService.createHabit(user.id, createDTO);
        if (res.success && res.data) {
          success('Habit Initialized', `"${res.data.name}" added to daily cadences.`);
          setIsCreateModalOpen(false);
          loadHabitsAndLogs();
        } else {
          error('Creation Failed', res.error?.message || 'Unable to create habit');
        }
      }
    } catch {
      error('Error', 'An unexpected error occurred saving habit.');
    }
  };

  // Toggle Day Completion
  const handleToggleDay = async (habitId: string, dateStr: string) => {
    if (!user?.id) return;
    const existingLog = logs.find((l) => l.habitId === habitId && l.date === dateStr && l.targetMet);

    if (existingLog) {
      const res = await habitService.unlogHabitCompletion(user.id, habitId, dateStr);
      if (res.success) {
        setLogs((prev) => prev.filter((l) => !(l.habitId === habitId && l.date === dateStr)));
        loadHabitsAndLogs();
      }
    } else {
      const habit = habits.find((h) => h.id === habitId);
      const val = habit?.targetUnits || 1;
      const res = await habitService.logHabitCompletion(user.id, habitId, dateStr, val);
      if (res.success && res.data) {
        setLogs((prev) => {
          const idx = prev.findIndex((l) => l.habitId === habitId && l.date === dateStr);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = res.data!;
            return updated;
          }
          return [...prev, res.data!];
        });
        loadHabitsAndLogs();
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        if (isToday) {
          success('Cadence Logged', `Checked in for today.`);
        }
      }
    }
  };

  // Delete Habit
  const handleDeleteHabit = async () => {
    if (!user?.id || !deletingHabitId) return;
    const res = await habitService.deleteHabit(user.id, deletingHabitId);
    if (res.success) {
      success('Habit Deleted', 'Cadence removed.');
      setDeletingHabitId(null);
      loadHabitsAndLogs();
    } else {
      error('Delete Failed', res.error?.message || 'Unable to delete habit');
    }
  };

  // Seed Starter Habits
  const handleSeedHabits = async () => {
    if (!user?.id) return;
    const res = await habitService.seedStarterHabits(user.id);
    if (res.success) {
      success('Starter Habits Seeded', 'Essential daily cadences loaded.');
      loadHabitsAndLogs();
    }
  };

  const toggleCustomDay = (dayIndex: number) => {
    setFormCustomDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Habits & Daily Cadences"
        description="Dynamic consistency tracking, recurring cadences, and mathematical streak engines."
        badge={{ label: `${stats.total} Cadences`, variant: 'subtle' }}
        actions={
          <div className="flex items-center gap-2">
            {habits.length === 0 && (
              <Button variant="outline" size="sm" leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleSeedHabits}>
                Seed Starter Habits
              </Button>
            )}
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateModal}>
              New Habit Cadence
            </Button>
          </div>
        }
      />

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Completed Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {stats.todayCompletedCount} / {stats.total}
          </p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Top Active Streak</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {stats.maxStreak} <span className="text-xs font-normal text-neutral-500">days</span>
          </p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Check-ins</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.totalMetLogs}</p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Consistency Rate</span>
            <Award className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {stats.total > 0 ? Math.round((stats.todayCompletedCount / stats.total) * 100) : 0}%
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search habits, routines, or cues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter habits by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Health & Vitality">Health & Vitality</option>
              <option value="Mind & Reflection">Mind & Reflection</option>
              <option value="Career & Craft">Career & Craft</option>
              <option value="Learning">Learning</option>
            </select>

            <select
              aria-label="Filter habits by cadence frequency"
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value as HabitFrequency | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Frequencies</option>
              <option value="daily">Daily Cadence</option>
              <option value="weekdays">Weekdays Only</option>
              <option value="weekends">Weekends Only</option>
              <option value="three_times_weekly">3x Weekly</option>
              <option value="custom">Custom Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 7-Day Completion Matrix Grid */}
      <Card className="overflow-x-auto">
        {habits.length === 0 && !isLoading ? (
          <EmptyState
            title="No habits match your active criteria"
            description="Initialize your daily cadences to build lasting consistency."
            actionLabel="Create First Habit"
            onAction={handleOpenCreateModal}
          />
        ) : (
          <div className="min-w-[640px]">
            {/* Matrix Table Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              <div className="w-1/3">Habit Cadence</div>
              <div className="w-24 text-center">Streak</div>
              <div className="flex-1 flex justify-around">
                {dateColumns.map((col) => (
                  <div
                    key={col.dateStr}
                    className={`flex flex-col items-center justify-center w-10 py-1 rounded-lg ${
                      col.isToday ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold' : ''
                    }`}
                  >
                    <span className="text-[10px] uppercase">{col.dayName}</span>
                    <span className="text-xs">{col.dayNum}</span>
                  </div>
                ))}
              </div>
              <div className="w-16 text-right">Actions</div>
            </div>

            {/* Matrix Rows */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {habits.map((habit) => {
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    {/* Left: Habit Info */}
                    <div className="w-1/3 space-y-1 pr-3 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {habit.name}
                        </h4>
                        <Badge variant="subtle" size="sm">
                          {habit.category}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {habit.routine}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                        <span className="capitalize">{habit.frequency.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          <span className="capitalize">{habit.timeOfDay}</span>
                        </span>
                        <span>•</span>
                        <span>
                          {habit.targetUnits} {habit.unitLabel}
                        </span>
                      </div>
                    </div>

                    {/* Streak Counter */}
                    <div className="w-24 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        <Flame
                          className={`h-4 w-4 ${
                            habit.streak.currentStreak > 0 ? 'text-amber-500 fill-amber-500' : 'text-neutral-300'
                          }`}
                        />
                        <span>{habit.streak.currentStreak}d</span>
                      </div>
                      <span className="text-[10px] text-neutral-400">Best: {habit.streak.longestStreak}d</span>
                    </div>

                    {/* 7-Day Matrix Toggles */}
                    <div className="flex-1 flex justify-around">
                      {dateColumns.map((col) => {
                        const isDone = logs.some(
                          (l) => l.habitId === habit.id && l.date === col.dateStr && l.targetMet
                        );

                        return (
                          <button
                            key={col.dateStr}
                            type="button"
                            onClick={() => handleToggleDay(habit.id, col.dateStr)}
                            title={`${col.dateStr}: ${isDone ? 'Completed' : 'Not completed'}`}
                            aria-label={`${habit.name} on ${col.dateStr}: ${isDone ? 'Completed' : 'Not completed'}`}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                              isDone
                                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-900 shadow-xs scale-105'
                                : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 fill-current" />
                            ) : (
                              <Circle className="h-4 w-4 opacity-40" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right: Actions */}
                    <div className="w-16 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(habit)}
                        title="Edit habit"
                        aria-label="Edit habit"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingHabitId(habit.id)}
                        title="Delete habit"
                        aria-label="Delete habit"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Habit Modal Dialog */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingHabit ? 'Edit Habit Cadence' : 'Initialize Habit Cadence'}
        description={
          editingHabit
            ? 'Adjust cadence parameters, cues, and routines.'
            : 'Establish a new intentional daily or weekly consistency cadence.'
        }
      >
        <form onSubmit={handleSaveHabit} className="space-y-4 py-2">
          <Input
            label="Habit Identity / Name"
            placeholder="e.g. Zone 2 Cardiovascular Baseline"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            error={formErrors.name}
            required
          />

          <Input
            label="Daily Routine / Action"
            placeholder="e.g. 35 minutes continuous cycling at 135 BPM"
            value={formRoutine}
            onChange={(e) => setFormRoutine(e.target.value)}
            error={formErrors.routine}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Habit Cue (Trigger)"
              placeholder="e.g. At 07:30 after hydration"
              value={formCue}
              onChange={(e) => setFormCue(e.target.value)}
            />

            <Input
              label="Habit Reward"
              placeholder="e.g. High mental alertness"
              value={formReward}
              onChange={(e) => setFormReward(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Category</label>
              <select
                aria-label="Habit category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="Health & Vitality">Health & Vitality</option>
                <option value="Mind & Reflection">Mind & Reflection</option>
                <option value="Career & Craft">Career & Craft</option>
                <option value="Learning">Learning</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Frequency</label>
              <select
                aria-label="Habit frequency"
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as HabitFrequency)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="daily">Daily (Every Day)</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="weekends">Weekends Only</option>
                <option value="three_times_weekly">3x Weekly</option>
                <option value="custom">Custom Days</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Time of Day</label>
              <select
                aria-label="Habit time of day"
                value={formTimeOfDay}
                onChange={(e) => setFormTimeOfDay(e.target.value as HabitTimeOfDay)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="anytime">Anytime</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Target Quantity"
              type="number"
              min="1"
              value={formTargetUnits}
              onChange={(e) => setFormTargetUnits(e.target.value)}
            />

            <Input
              label="Unit Label"
              placeholder="e.g. mins, pages, session"
              value={formUnitLabel}
              onChange={(e) => setFormUnitLabel(e.target.value)}
            />
          </div>

          {/* Conditional Custom Days Picker */}
          {formFrequency === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Select Active Days
              </label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((day, idx) => {
                  const isSelected = formCustomDays.includes(idx);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleCustomDay(idx)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingHabit ? 'Update Habit' : 'Initialize Habit'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deletingHabitId}
        onClose={() => setDeletingHabitId(null)}
        title="Delete Habit Cadence"
        description="Are you sure you want to remove this habit and its historical logs? This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingHabitId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteHabit}>
              Delete Habit
            </Button>
          </>
        }
      >
        <div className="py-2 text-xs text-neutral-500">
          This habit and its check-in records will be permanently removed.
        </div>
      </Dialog>
    </div>
  );
}
