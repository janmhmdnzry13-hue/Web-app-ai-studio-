import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { habitService } from '../../services/habit.service';
import { safeStorage } from '../../lib/storage';
import {
  Habit,
  HabitLog,
  CreateHabitDTO,
} from '../../types/habit.types';
import { TodayView } from './components/TodayView';
import { WeekView } from './components/WeekView';
import { InsightsView } from './components/InsightsView';
import { CreateHabitModal } from './components/CreateHabitModal';
import { HabitDetailModal } from './components/HabitDetailModal';
import { EditWhyModal } from './components/EditWhyModal';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Plus, Sparkles } from 'lucide-react';
import { getLocalDateString } from '../../lib/dateUtils';

type HabitTab = 'today' | 'week' | 'insights';

const DEFAULT_USER_WHY = 'I build habits so I can have more energy to create, help others, and live freely.';

export function HabitsView() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<HabitTab>('today');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // User's custom "Your Why" personal identity statement
  const [userWhy, setUserWhy] = useState<string>(() => {
    return safeStorage.get<string>(`origin_why_${user?.id || 'default'}`, DEFAULT_USER_WHY);
  });
  const [isEditWhyOpen, setIsEditWhyOpen] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedHabitDetail, setSelectedHabitDetail] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [initialTemplate, setInitialTemplate] = useState<Partial<CreateHabitDTO> | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load habits and logs
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        habitService.getHabits(user.id),
        habitService.getHabitLogs(user.id),
      ]);

      if (habitsRes.success && habitsRes.data) {
        setHabits([...habitsRes.data]);
      }
      if (logsRes.success && logsRes.data) {
        setLogs([...logsRes.data]);
      }
    } catch {
      error('Load Error', 'Failed to retrieve habits.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save User Why
  const handleSaveWhy = (newWhy: string) => {
    setUserWhy(newWhy);
    if (user?.id) {
      safeStorage.set(`origin_why_${user.id}`, newWhy);
    }
    success('Identity Anchor Saved', 'Your personal Why has been updated.');
  };

  // Toggle Completion for a Specific Date (Optimistic Update)
  const handleToggleDayCompletion = async (habitId: string, dateStr: string) => {
    if (!user?.id) return;
    const existingLog = logs.find(
      (l) => l.habitId === habitId && l.date === dateStr && l.targetMet
    );

    if (existingLog) {
      // Unlog
      setLogs((prev) => prev.filter((l) => !(l.habitId === habitId && l.date === dateStr)));
      const res = await habitService.unlogHabitCompletion(user.id, habitId, dateStr);
      if (!res.success) {
        // Revert on failure
        loadData();
        error('Error', 'Unable to remove log.');
      } else {
        loadData();
      }
    } else {
      // Log
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
        loadData();

        // Subtle encouraging feedback for today
        const isToday = dateStr === getLocalDateString(new Date());
        if (isToday) {
          success('✓ Done', 'Nice work taking action today.');
        }
      }
    }
  };

  // Toggle Today's Completion
  const handleToggleToday = (habitId: string) => {
    const todayStr = getLocalDateString(new Date());
    handleToggleDayCompletion(habitId, todayStr);
  };

  // Update specific numeric value for today (e.g. 6/10 pages)
  const handleUpdateTodayValue = async (habitId: string, newValue: number) => {
    if (!user?.id) return;
    const todayStr = getLocalDateString(new Date());
    const res = await habitService.logHabitCompletion(user.id, habitId, todayStr, newValue);
    if (res.success && res.data) {
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.habitId === habitId && l.date === todayStr);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = res.data!;
          return updated;
        }
        return [...prev, res.data!];
      });
      loadData();
    }
  };

  // Create or Update Habit
  const handleSaveHabit = async (dto: CreateHabitDTO): Promise<boolean> => {
    if (!user?.id) {
      error('Authentication Required', 'You must be signed in to manage habits.');
      return false;
    }
    if (editingHabit) {
      const res = await habitService.updateHabit(user.id, editingHabit.id, dto);
      if (res.success && res.data) {
        success('Habit Updated', `"${res.data.name}" has been updated.`);
        setEditingHabit(null);
        await loadData();
        return true;
      } else {
        error('Update Failed', res.error?.message || 'Failed to update habit');
        return false;
      }
    } else {
      const res = await habitService.createHabit(user.id, dto);
      if (res.success && res.data) {
        success('Habit Created', `"${res.data.name}" added to your space.`);
        await loadData();
        return true;
      } else {
        error('Create Failed', res.error?.message || 'Failed to create habit');
        return false;
      }
    }
  };

  // Request Delete Habit (shows confirmation modal)
  const handleDeleteHabit = (habitId: string) => {
    const target = habits.find((h) => h.id === habitId) || selectedHabitDetail;
    if (target) {
      setSelectedHabitDetail(null);
      setHabitToDelete(target);
    }
  };

  // Confirm and Execute Habit Deletion
  const handleConfirmDelete = async () => {
    if (!user?.id || !habitToDelete) return;
    setIsDeleting(true);
    try {
      const res = await habitService.deleteHabit(user.id, habitToDelete.id);
      if (res.success) {
        success('Habit Deleted', `"${habitToDelete.name}" was removed.`);
        setHabitToDelete(null);
        await loadData();
      } else {
        error('Delete Failed', res.error?.message || 'Failed to delete habit');
      }
    } catch (err: any) {
      error('Delete Failed', err.message || 'Failed to delete habit.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handlers for modal triggers
  const handleOpenCreateModal = (template?: Partial<CreateHabitDTO>) => {
    setEditingHabit(null);
    setInitialTemplate(template || null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setInitialTemplate(null);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full pb-12 animate-in fade-in duration-200">
      {/* 1. Header (Clean, Focused, Human) */}
      <header className="flex items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight text-neutral-950 dark:text-[#F0EEE6]">
              Habits
            </h1>
            <span className="text-xl" role="img" aria-label="sprout">
              🌱
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-[#8D9793] mt-0.5">
            Small actions, big change.
          </p>
        </div>

        {/* Primary Action */}
        <button
          type="button"
          onClick={() => handleOpenCreateModal()}
          aria-label="Add habit"
          className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-neutral-950 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Add habit</span>
        </button>
      </header>

      {/* 2. Top View Navigation Tabs (Today | Week | Insights) */}
      <div className="flex items-center gap-6 border-b border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)]">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`pb-3 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer ${
            activeTab === 'today'
              ? 'text-neutral-950 dark:text-[#F0EEE6] font-semibold'
              : 'text-neutral-500 dark:text-[#8D9793] hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          Today
          {activeTab === 'today' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('week')}
          className={`pb-3 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer ${
            activeTab === 'week'
              ? 'text-neutral-950 dark:text-[#F0EEE6] font-semibold'
              : 'text-neutral-500 dark:text-[#8D9793] hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          Week
          {activeTab === 'week' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('insights')}
          className={`pb-3 text-xs sm:text-sm font-medium transition-colors relative cursor-pointer ${
            activeTab === 'insights'
              ? 'text-neutral-950 dark:text-[#F0EEE6] font-semibold'
              : 'text-neutral-500 dark:text-[#8D9793] hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          Insights
          {activeTab === 'insights' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
          )}
        </button>
      </div>

      {/* 3. Main Tab Content */}
      <main>
        {activeTab === 'today' && (
          <TodayView
            displayName={user?.profile?.displayName}
            habits={habits}
            logs={logs}
            userWhy={userWhy}
            onOpenEditWhy={() => setIsEditWhyOpen(true)}
            onToggleComplete={handleToggleToday}
            onUpdateValue={handleUpdateTodayValue}
            onOpenDetail={(habit) => setSelectedHabitDetail(habit)}
            onCreateClick={handleOpenCreateModal}
          />
        )}

        {activeTab === 'week' && (
          <WeekView
            habits={habits}
            logs={logs}
            onToggleDay={handleToggleDayCompletion}
            onOpenDetail={(habit) => setSelectedHabitDetail(habit)}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsView habits={habits} logs={logs} />
        )}
      </main>

      {/* 4. Modals & Dialogs */}
      {/* Create / Edit Habit Modal */}
      <CreateHabitModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingHabit(null);
          setInitialTemplate(null);
        }}
        onSave={handleSaveHabit}
        editingHabit={editingHabit}
        initialTemplate={initialTemplate}
      />

      {/* Habit Detail Modal */}
      <HabitDetailModal
        isOpen={!!selectedHabitDetail}
        onClose={() => setSelectedHabitDetail(null)}
        habit={selectedHabitDetail}
        logs={logs}
        onToggleToday={handleToggleToday}
        onUpdateTodayValue={handleUpdateTodayValue}
        onEdit={(habit) => {
          setSelectedHabitDetail(null);
          handleOpenEditModal(habit);
        }}
        onDelete={handleDeleteHabit}
      />

      {/* Edit Your Why Modal */}
      <EditWhyModal
        isOpen={isEditWhyOpen}
        onClose={() => setIsEditWhyOpen(false)}
        currentWhy={userWhy}
        onSave={handleSaveWhy}
      />

      {/* Delete Habit Confirmation Dialog */}
      <Dialog
        isOpen={!!habitToDelete}
        onClose={() => !isDeleting && setHabitToDelete(null)}
        title="Delete this habit?"
        description="Are you sure you want to delete this habit?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHabitToDelete(null)}
              disabled={isDeleting}
              className="min-h-[38px] px-3.5 text-xs sm:text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="min-h-[38px] px-4 bg-rose-600 hover:bg-rose-700 text-white border-0 font-medium text-xs sm:text-sm shadow-xs"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      >
        <div className="py-2 space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-[#8D9793]">
          <p>
            Habit:{' '}
            <span className="font-semibold text-neutral-900 dark:text-[#F0EEE6]">
              {habitToDelete?.name}
            </span>
          </p>
          <p className="text-xs text-neutral-500 dark:text-[#707A75] leading-relaxed">
            This will permanently remove this habit along with all associated check-ins and streaks. This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
