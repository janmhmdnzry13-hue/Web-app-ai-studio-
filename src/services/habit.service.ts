/**
 * Habit Service Implementation
 * Authenticated Backend API is the single source of truth for Habits data,
 * with client-side cache and offline resilience.
 * Dynamic streak calculation is performed against actual log history.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';
import { generateId } from '../lib/utils';
import { DateOnlyString, ServiceResult } from '../types/common.types';
import {
  CreateHabitDTO,
  Habit,
  HabitFrequency,
  HabitLog,
  HabitStreak,
} from '../types/habit.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';
import { getTodayDateString as getLocalTodayDateString, getLocalDateString } from '../lib/dateUtils';

export interface IHabitService {
  getHabits(userId?: string): Promise<ServiceResult<readonly Habit[]>>;
  getHabitLogs(
    userId?: string,
    habitId?: string,
    startDate?: DateOnlyString,
    endDate?: DateOnlyString
  ): Promise<ServiceResult<readonly HabitLog[]>>;
  createHabit(userIdOrDto: string | CreateHabitDTO, maybeDto?: CreateHabitDTO): Promise<ServiceResult<Habit>>;
  updateHabit(
    userIdOrId: string,
    idOrUpdates: string | Partial<Habit>,
    maybeUpdates?: Partial<Habit>
  ): Promise<ServiceResult<Habit>>;
  archiveHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  deleteHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  logHabitCompletion(
    userIdOrHabitId: string,
    habitIdOrDate: string,
    dateOrValue?: string | number,
    maybeValue?: number,
    maybeNotes?: string
  ): Promise<ServiceResult<HabitLog>>;
  unlogHabitCompletion(
    userIdOrHabitId: string,
    habitIdOrDate: string,
    maybeDate?: string
  ): Promise<ServiceResult<void>>;
  seedStarterHabits(userId: string): Promise<ServiceResult<Habit[]>>;
}

export const STARTER_HABITS: readonly Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'streak'>[] = [
  {
    name: 'Zone 2 Cardiovascular Aerobic Session',
    cue: 'At 07:30 after morning hydration',
    routine: 'Perform 35 minutes continuous Zone 2 cycling or rowing at 135 BPM',
    reward: 'Mental clarity and metabolic energy',
    category: 'Health & Vitality',
    frequency: 'daily',
    timeOfDay: 'morning',
    targetUnits: 35,
    unitLabel: 'mins',
    isArchived: false,
  },
  {
    name: 'Deep Work Focus Block (No Distractions)',
    cue: 'When opening workspace at 09:00',
    routine: 'Complete 90 minutes of uninterrupted core engineering architecture',
    reward: 'Significant craft momentum and focus flow',
    category: 'Career & Craft',
    frequency: 'weekdays',
    timeOfDay: 'morning',
    targetUnits: 90,
    unitLabel: 'mins',
    isArchived: false,
  },
  {
    name: 'Evening Retrospective & Synthesis Log',
    cue: 'At 21:30 before winding down',
    routine: 'Record 3 wins, 1 lesson, and plan tomorrow top 3 intentions',
    reward: 'Quiet psychological closure and restful sleep',
    category: 'Mind & Reflection',
    frequency: 'daily',
    timeOfDay: 'evening',
    targetUnits: 1,
    unitLabel: 'session',
    isArchived: false,
  },
  {
    name: 'Hydration Target (3,000ml Filtered Water)',
    cue: 'Throughout the active day',
    routine: 'Drink 3L of electrolyte-balanced water',
    reward: 'Optimal cognitive and cellular function',
    category: 'Health & Vitality',
    frequency: 'daily',
    timeOfDay: 'anytime',
    targetUnits: 3000,
    unitLabel: 'ml',
    isArchived: false,
  },
];

export function getTodayDateString(): DateOnlyString {
  return getLocalTodayDateString();
}

export function isDayExpectedForFrequency(
  dateStr: string,
  frequency: HabitFrequency,
  customDays?: readonly number[]
): boolean {
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'three_times_weekly':
      return true;
    case 'custom':
      return customDays ? customDays.includes(dayOfWeek) : true;
    default:
      return true;
  }
}

export function calculateHabitStreak(
  frequency: HabitFrequency,
  customDays: readonly number[] | undefined,
  completedDatesSet: Set<string>
): HabitStreak {
  const totalCompletions = completedDatesSet.size;
  if (totalCompletions === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalCompletions: 0,
    };
  }

  const sortedDates = Array.from(completedDatesSet).sort();
  const lastCompletedDate = sortedDates[sortedDates.length - 1];

  // 1. Calculate Current Streak
  const today = getTodayDateString();
  let currentStreak = 0;

  const parts = today.split('-').map(Number);
  const checkDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  const todayCompleted = completedDatesSet.has(today);

  // If not completed today, start checking from yesterday without breaking streak yet
  if (!todayCompleted) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Walk backwards day by day
  for (let i = 0; i < 365; i++) {
    const dStr = getLocalDateString(checkDate);
    const isExpected = isDayExpectedForFrequency(dStr, frequency, customDays);

    if (isExpected) {
      if (completedDatesSet.has(dStr)) {
        currentStreak++;
      } else {
        break;
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 2. Calculate Longest Streak
  let longestStreak = 0;
  let tempStreak = 0;

  if (sortedDates.length > 0) {
    const startParts = sortedDates[0].split('-').map(Number);
    const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2], 12, 0, 0);
    const endParts = today.split('-').map(Number);
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2], 12, 0, 0);
    const scanDate = new Date(startDate);

    while (scanDate <= endDate) {
      const dStr = getLocalDateString(scanDate);
      const isExpected = isDayExpectedForFrequency(dStr, frequency, customDays);

      if (isExpected) {
        if (completedDatesSet.has(dStr)) {
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      }
      scanDate.setDate(scanDate.getDate() + 1);
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    lastCompletedDate,
  };
}

function mapHabitRecordToHabit(record: any, logs: readonly HabitLog[] = []): Habit {
  const habitLogs = logs.filter((l) => l.habitId === record.id && l.targetMet);
  const completedDatesSet = new Set(habitLogs.map((l) => l.date));

  const customDays = Array.isArray(record.customDaysOfWeek)
    ? record.customDaysOfWeek
    : Array.isArray(record.targetDays)
    ? record.targetDays
    : undefined;

  const dynamicStreak =
    logs.length > 0 || completedDatesSet.size > 0
      ? calculateHabitStreak((record.frequency || 'daily') as HabitFrequency, customDays, completedDatesSet)
      : {
          currentStreak: Number(record.streakCount || record.streak?.currentStreak || 0),
          longestStreak: Number(record.bestStreak || record.streak?.longestStreak || 0),
          totalCompletions: Number(record.totalCompletions || record.streak?.totalCompletions || 0),
          lastCompletedDate: record.lastCompletedDate || record.streak?.lastCompletedDate,
        };

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    cue: record.cue || '',
    routine: record.routine || record.description || record.name,
    reward: record.reward || '',
    category: record.category || 'Health & Vitality',
    frequency: (record.frequency || 'daily') as HabitFrequency,
    customDaysOfWeek: customDays,
    timeOfDay: record.timeOfDay || 'morning',
    targetUnits:
      typeof record.targetUnits === 'number' && record.targetUnits > 0
        ? record.targetUnits
        : typeof record.targetPerDay === 'number' && record.targetPerDay > 0
        ? record.targetPerDay
        : 1,
    unitLabel: record.unitLabel || record.unit || 'session',
    streak: dynamicStreak,
    isArchived: Boolean(record.archived !== undefined ? record.archived : record.isArchived),
    goalId: record.goalId || undefined,
    why: record.why || '',
    icon: record.icon || '🌱',
    color: record.color || '',
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

function mapHabitLogRecordToHabitLog(record: any): HabitLog {
  const isCompleted = Boolean(record.completed !== undefined ? record.completed : record.targetMet);
  const val = typeof record.value === 'number' ? record.value : isCompleted ? 1 : 0;
  const targetMet = record.targetMet !== undefined ? Boolean(record.targetMet) : isCompleted || val > 0;

  return {
    id: record.id,
    userId: record.userId,
    habitId: record.habitId,
    date: typeof record.date === 'string' ? record.date.slice(0, 10) : record.date,
    value: val,
    targetMet,
    notes: record.notes || undefined,
    loggedAt: record.loggedAt || record.createdAt || new Date().toISOString(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

export class HabitService extends BaseService implements IHabitService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return '';
  }

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`;
  }

  private getLogsStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`;
  }

  private getStoredHabits(userId: string): Habit[] {
    if (!userId) return [];
    return safeStorage.get<Habit[]>(this.getStorageKey(userId), []);
  }

  private saveStoredHabits(userId: string, habits: Habit[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), habits);
  }

  private getStoredLogs(userId: string): HabitLog[] {
    if (!userId) return [];
    return safeStorage.get<HabitLog[]>(this.getLogsStorageKey(userId), []);
  }

  private saveStoredLogs(userId: string, logs: HabitLog[]): void {
    if (!userId) return;
    safeStorage.set(this.getLogsStorageKey(userId), logs);
  }

  async getHabits(userIdOrNull?: string): Promise<ServiceResult<readonly Habit[]>> {
    try {
      const userId = await this.resolveUserId(userIdOrNull);

      let habits: Habit[] = [];
      const [habitsRes, logsRes] = await Promise.all([
        apiClient.get<any[]>('/api/habits'),
        apiClient.get<any[]>('/api/habits/logs'),
      ]);

      if (habitsRes.success && Array.isArray(habitsRes.data)) {
        const logs: HabitLog[] =
          logsRes.success && Array.isArray(logsRes.data)
            ? logsRes.data.map(mapHabitLogRecordToHabitLog)
            : [];

        habits = habitsRes.data.map((record) => mapHabitRecordToHabit(record, logs));
        if (userId) {
          this.saveStoredHabits(userId, habits);
          if (logs.length > 0) {
            this.saveStoredLogs(userId, logs);
          }
        }
        return this.success(habits);
      }

      // Offline / test fallback
      if (userId) {
        const storedLogs = this.getStoredLogs(userId);
        const storedHabits = this.getStoredHabits(userId);
        habits = storedHabits.map((h) => mapHabitRecordToHabit(h, storedLogs));
        return this.success(habits);
      }

      return this.failure(
        habitsRes.error?.code || 'HABIT_FETCH_ERROR',
        habitsRes.error?.message || 'Failed to retrieve habits.'
      );
    } catch (err: any) {
      return this.failure('HABIT_FETCH_ERROR', err?.message || 'Failed to retrieve habits.', { err });
    }
  }

  async getHabitLogs(
    userIdOrHabitId?: string,
    maybeHabitIdOrStartDate?: string,
    startDate?: DateOnlyString,
    endDate?: DateOnlyString
  ): Promise<ServiceResult<readonly HabitLog[]>> {
    try {
      let userId: string;
      let habitId: string | undefined;
      let start: DateOnlyString | undefined;
      let end: DateOnlyString | undefined;

      if (startDate !== undefined || endDate !== undefined) {
        userId = await this.resolveUserId(userIdOrHabitId);
        habitId = maybeHabitIdOrStartDate;
        start = startDate;
        end = endDate;
      } else if (maybeHabitIdOrStartDate !== undefined) {
        userId = await this.resolveUserId(userIdOrHabitId);
        habitId = maybeHabitIdOrStartDate;
      } else {
        userId = await this.resolveUserId(userIdOrHabitId);
      }

      const params = new URLSearchParams();
      if (habitId) params.append('habitId', habitId);
      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);

      const qs = params.toString();
      const endpoint = qs ? `/api/habits/logs?${qs}` : '/api/habits/logs';

      const res = await apiClient.get<any[]>(endpoint);
      if (res.success && Array.isArray(res.data)) {
        const logs = res.data.map(mapHabitLogRecordToHabitLog);
        if (userId) {
          this.saveStoredLogs(userId, logs);
        }
        return this.success(logs);
      }

      // Offline / test fallback
      if (userId) {
        let storedLogs = this.getStoredLogs(userId);
        if (habitId) {
          storedLogs = storedLogs.filter((l) => l.habitId === habitId);
        }
        if (start) {
          storedLogs = storedLogs.filter((l) => l.date >= start);
        }
        if (end) {
          storedLogs = storedLogs.filter((l) => l.date <= end);
        }
        return this.success(storedLogs);
      }

      return this.failure(
        res.error?.code || 'HABIT_LOGS_ERROR',
        res.error?.message || 'Failed to retrieve habit logs.'
      );
    } catch (err: any) {
      return this.failure('HABIT_LOGS_ERROR', err?.message || 'Failed to retrieve habit logs.', { err });
    }
  }

  async createHabit(userIdOrDto: string | CreateHabitDTO, maybeDto?: CreateHabitDTO): Promise<ServiceResult<Habit>> {
    try {
      let userId: string;
      let dto: CreateHabitDTO;

      if (typeof userIdOrDto === 'string') {
        userId = await this.resolveUserId(userIdOrDto);
        dto = maybeDto as CreateHabitDTO;
      } else {
        userId = await this.resolveUserId();
        dto = userIdOrDto as CreateHabitDTO;
      }

      if (!dto || !dto.name || dto.name.trim().length === 0) {
        return this.failure('HABIT_VALIDATION_ERROR', 'Habit name is required and cannot be empty.');
      }

      const trimmedName = dto.name.trim();
      const routineText = dto.routine && dto.routine.trim().length > 0 ? dto.routine.trim() : trimmedName;
      const targetDays =
        dto.frequency === 'custom'
          ? dto.customDaysOfWeek && dto.customDaysOfWeek.length > 0
            ? dto.customDaysOfWeek
            : [1, 2, 3, 4, 5]
          : undefined;
      const units = typeof dto.targetUnits === 'number' && dto.targetUnits > 0 ? dto.targetUnits : 1;
      const unitLabel = dto.unitLabel?.trim() || 'session';

      const payload = {
        name: trimmedName,
        routine: routineText,
        description: dto.routine || trimmedName,
        cue: dto.cue?.trim() || '',
        reward: dto.reward?.trim() || '',
        category: dto.category || 'Health & Vitality',
        frequency: dto.frequency || 'daily',
        targetDays: targetDays ? [...targetDays] : undefined,
        customDaysOfWeek: targetDays ? [...targetDays] : undefined,
        timeOfDay: dto.timeOfDay || 'morning',
        targetUnits: units,
        targetPerDay: units,
        unit: unitLabel,
        unitLabel: unitLabel,
        why: dto.why?.trim() || '',
        icon: dto.icon || '🌱',
        color: dto.color || '',
        goalId: dto.goalId || null,
      };

      const res = await apiClient.post<any>('/api/habits', payload);
      if (res.success && res.data) {
        const createdHabit = mapHabitRecordToHabit(res.data, []);
        if (userId) {
          const stored = this.getStoredHabits(userId);
          stored.push(createdHabit);
          this.saveStoredHabits(userId, stored);
        }
        return this.success(createdHabit);
      }

      // Offline / test fallback
      const newHabit: Habit = {
        id: generateId('hbt'),
        userId: userId || 'usr_anonymous',
        goalId: dto.goalId,
        name: trimmedName,
        routine: routineText,
        cue: dto.cue?.trim() || '',
        reward: dto.reward?.trim() || '',
        category: dto.category || 'Health & Vitality',
        frequency: dto.frequency || 'daily',
        customDaysOfWeek: targetDays,
        timeOfDay: dto.timeOfDay || 'morning',
        targetUnits: units,
        unitLabel: unitLabel,
        streak: { currentStreak: 0, longestStreak: 0, totalCompletions: 0 },
        isArchived: false,
        why: dto.why?.trim() || '',
        icon: dto.icon || '🌱',
        color: dto.color || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (userId) {
        const stored = this.getStoredHabits(userId);
        stored.push(newHabit);
        this.saveStoredHabits(userId, stored);
      }

      return this.success(newHabit);
    } catch (err: any) {
      return this.failure('HABIT_CREATE_ERROR', err?.message || 'Failed to create habit.', { err });
    }
  }

  async updateHabit(
    userIdOrId: string,
    idOrUpdates: string | Partial<Habit>,
    maybeUpdates?: Partial<Habit>
  ): Promise<ServiceResult<Habit>> {
    try {
      let userId: string;
      let habitId: string;
      let updates: Partial<Habit>;

      if (maybeUpdates) {
        userId = await this.resolveUserId(userIdOrId);
        habitId = idOrUpdates as string;
        updates = maybeUpdates;
      } else {
        userId = await this.resolveUserId();
        habitId = userIdOrId;
        updates = idOrUpdates as Partial<Habit>;
      }

      if (!habitId) {
        return this.failure('HABIT_NOT_FOUND', 'Habit ID is required.');
      }

      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return this.failure('HABIT_VALIDATION_ERROR', 'Habit name cannot be empty.');
      }

      const payload: Record<string, any> = { ...updates };
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.routine !== undefined) payload.routine = updates.routine.trim();
      if (updates.cue !== undefined) payload.cue = updates.cue.trim();
      if (updates.reward !== undefined) payload.reward = updates.reward.trim();
      if (updates.why !== undefined) payload.why = updates.why.trim();
      if (updates.unitLabel !== undefined) {
        payload.unitLabel = updates.unitLabel.trim();
        payload.unit = updates.unitLabel.trim();
      }
      if (updates.targetUnits !== undefined) {
        const val = Number(updates.targetUnits) > 0 ? Number(updates.targetUnits) : 1;
        payload.targetUnits = val;
        payload.targetPerDay = val;
      }
      if (updates.customDaysOfWeek !== undefined) {
        payload.targetDays = Array.isArray(updates.customDaysOfWeek) ? [...updates.customDaysOfWeek] : [];
        payload.customDaysOfWeek = payload.targetDays;
      }
      if (updates.isArchived !== undefined) {
        payload.archived = Boolean(updates.isArchived);
      }

      const res = await apiClient.put<any>(`/api/habits/${habitId}`, payload);
      if (res.success && res.data) {
        const updatedHabit = mapHabitRecordToHabit(res.data, []);
        if (userId) {
          const stored = this.getStoredHabits(userId).map((h) => (h.id === habitId ? updatedHabit : h));
          this.saveStoredHabits(userId, stored);
        }
        return this.success(updatedHabit);
      }

      // Offline / test fallback
      if (userId) {
        const stored = this.getStoredHabits(userId);
        const idx = stored.findIndex((h) => h.id === habitId);
        if (idx !== -1) {
          const updated: Habit = {
            ...stored[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          stored[idx] = updated;
          this.saveStoredHabits(userId, stored);
          return this.success(updated);
        }
      }

      return this.failure(
        res.error?.code || 'HABIT_UPDATE_ERROR',
        res.error?.message || `Habit with ID ${habitId} not found.`
      );
    } catch (err: any) {
      return this.failure('HABIT_UPDATE_ERROR', err?.message || 'Failed to update habit.', { err });
    }
  }

  async archiveHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = await this.resolveUserId(maybeId ? userIdOrId : undefined);
      const habitId = maybeId || userIdOrId;
      if (!habitId) {
        return this.failure('HABIT_NOT_FOUND', 'Habit ID is required.');
      }

      const res = await apiClient.patch<any>(`/api/habits/${habitId}`, { archived: true, isArchived: true });
      if (res.success) {
        if (userId) {
          const stored = this.getStoredHabits(userId).map((h) =>
            h.id === habitId ? { ...h, isArchived: true, updatedAt: new Date().toISOString() } : h
          );
          this.saveStoredHabits(userId, stored);
        }
        return this.success(undefined);
      }

      if (userId) {
        const stored = this.getStoredHabits(userId).map((h) =>
          h.id === habitId ? { ...h, isArchived: true, updatedAt: new Date().toISOString() } : h
        );
        this.saveStoredHabits(userId, stored);
        return this.success(undefined);
      }

      return this.failure(
        res.error?.code || 'HABIT_ARCHIVE_ERROR',
        res.error?.message || `Habit with ID ${habitId} not found.`
      );
    } catch (err: any) {
      return this.failure('HABIT_ARCHIVE_ERROR', err?.message || 'Failed to archive habit.', { err });
    }
  }

  async deleteHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = await this.resolveUserId(maybeId ? userIdOrId : undefined);
      const habitId = maybeId || userIdOrId;
      if (!habitId) {
        return this.failure('HABIT_NOT_FOUND', 'Habit ID is required.');
      }

      const res = await apiClient.delete<any>(`/api/habits/${habitId}`);
      if (res.success) {
        if (userId) {
          const stored = this.getStoredHabits(userId).filter((h) => h.id !== habitId);
          this.saveStoredHabits(userId, stored);
        }
        return this.success(undefined);
      }

      if (userId) {
        const stored = this.getStoredHabits(userId).filter((h) => h.id !== habitId);
        this.saveStoredHabits(userId, stored);
        return this.success(undefined);
      }

      return this.failure(
        res.error?.code || 'HABIT_DELETE_ERROR',
        res.error?.message || `Habit with ID ${habitId} not found.`
      );
    } catch (err: any) {
      return this.failure('HABIT_DELETE_ERROR', err?.message || 'Failed to delete habit.', { err });
    }
  }

  async logHabitCompletion(
    userIdOrHabitId: string,
    habitIdOrDate: string,
    dateOrValue?: string | number,
    maybeValue?: number,
    maybeNotes?: string
  ): Promise<ServiceResult<HabitLog>> {
    try {
      let userId: string;
      let habitId: string;
      let date: DateOnlyString;
      let value: number = 1;
      let notes: string | undefined;

      if (typeof dateOrValue === 'string') {
        userId = await this.resolveUserId(userIdOrHabitId);
        habitId = habitIdOrDate;
        date = dateOrValue;
        value = typeof maybeValue === 'number' ? maybeValue : 1;
        notes = maybeNotes;
      } else {
        userId = await this.resolveUserId();
        habitId = userIdOrHabitId;
        date = habitIdOrDate;
        value = typeof dateOrValue === 'number' ? dateOrValue : 1;
        notes = typeof maybeValue === 'string' ? maybeValue : undefined;
      }

      if (!habitId) {
        return this.failure('HABIT_NOT_FOUND', 'Habit ID is required.');
      }

      const payload = {
        habitId,
        date: date || getTodayDateString(),
        completed: true,
        value,
        notes,
      };

      const res = await apiClient.post<any>('/api/habits/log', payload);
      if (res.success && res.data) {
        const rawLog = res.data.log || res.data;
        const mappedLog = mapHabitLogRecordToHabitLog(rawLog);
        if (userId) {
          const storedLogs = this.getStoredLogs(userId).filter(
            (l) => !(l.habitId === habitId && l.date === date)
          );
          storedLogs.push(mappedLog);
          this.saveStoredLogs(userId, storedLogs);

          // Update habit streak in cache
          const storedHabits = this.getStoredHabits(userId);
          const hIdx = storedHabits.findIndex((h) => h.id === habitId);
          if (hIdx !== -1) {
            storedHabits[hIdx] = mapHabitRecordToHabit(storedHabits[hIdx], storedLogs);
            this.saveStoredHabits(userId, storedHabits);
          }
        }
        return this.success(mappedLog);
      }

      // Offline / test fallback
      const newLog: HabitLog = {
        id: generateId('hlog'),
        userId: userId || 'usr_anonymous',
        habitId,
        date: date || getTodayDateString(),
        value,
        targetMet: true,
        notes,
        loggedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (userId) {
        const storedLogs = this.getStoredLogs(userId).filter(
          (l) => !(l.habitId === habitId && l.date === date)
        );
        storedLogs.push(newLog);
        this.saveStoredLogs(userId, storedLogs);

        const storedHabits = this.getStoredHabits(userId);
        const hIdx = storedHabits.findIndex((h) => h.id === habitId);
        if (hIdx !== -1) {
          storedHabits[hIdx] = mapHabitRecordToHabit(storedHabits[hIdx], storedLogs);
          this.saveStoredHabits(userId, storedHabits);
        }
      }

      return this.success(newLog);
    } catch (err: any) {
      return this.failure('HABIT_LOG_ERROR', err?.message || 'Failed to log habit completion.', { err });
    }
  }

  async unlogHabitCompletion(
    userIdOrHabitId: string,
    habitIdOrDate: string,
    maybeDate?: string
  ): Promise<ServiceResult<void>> {
    try {
      let userId: string;
      let habitId: string;
      let date: DateOnlyString;

      if (maybeDate) {
        userId = await this.resolveUserId(userIdOrHabitId);
        habitId = habitIdOrDate;
        date = maybeDate;
      } else {
        userId = await this.resolveUserId();
        habitId = userIdOrHabitId;
        date = habitIdOrDate;
      }

      if (!habitId || !date) {
        return this.failure('HABIT_UNLOG_ERROR', 'Habit ID and date are required.');
      }

      const res = await apiClient.delete<any>(`/api/habits/${habitId}/logs/${date}`);
      if (res.success) {
        if (userId) {
          const storedLogs = this.getStoredLogs(userId).filter(
            (l) => !(l.habitId === habitId && l.date === date)
          );
          this.saveStoredLogs(userId, storedLogs);

          const storedHabits = this.getStoredHabits(userId);
          const hIdx = storedHabits.findIndex((h) => h.id === habitId);
          if (hIdx !== -1) {
            storedHabits[hIdx] = mapHabitRecordToHabit(storedHabits[hIdx], storedLogs);
            this.saveStoredHabits(userId, storedHabits);
          }
        }
        return this.success(undefined);
      }

      if (userId) {
        const storedLogs = this.getStoredLogs(userId).filter(
          (l) => !(l.habitId === habitId && l.date === date)
        );
        this.saveStoredLogs(userId, storedLogs);

        const storedHabits = this.getStoredHabits(userId);
        const hIdx = storedHabits.findIndex((h) => h.id === habitId);
        if (hIdx !== -1) {
          storedHabits[hIdx] = mapHabitRecordToHabit(storedHabits[hIdx], storedLogs);
          this.saveStoredHabits(userId, storedHabits);
        }
        return this.success(undefined);
      }

      return this.failure(
        res.error?.code || 'HABIT_UNLOG_ERROR',
        res.error?.message || 'Failed to remove habit log.'
      );
    } catch (err: any) {
      return this.failure('HABIT_UNLOG_ERROR', err?.message || 'Failed to remove habit log.', { err });
    }
  }

  async seedStarterHabits(userId: string): Promise<ServiceResult<Habit[]>> {
    try {
      const createdHabits: Habit[] = [];
      for (const starter of STARTER_HABITS) {
        const res = await this.createHabit(userId, starter);
        if (res.success && res.data) {
          createdHabits.push(res.data);
        }
      }
      return this.success(createdHabits);
    } catch (err: any) {
      return this.failure('HABIT_SEED_ERROR', 'Failed to seed starter habits.', { err });
    }
  }
}

export const habitService = new HabitService();
