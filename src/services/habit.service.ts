/**
 * Habit Service Contract & Dynamic Streak Calculation Engine
 * Calculates true mathematical sequential streaks based on frequency rules, logs, and calendar continuity.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { DateOnlyString, ServiceResult } from '../types/common.types';
import { CreateHabitDTO, Habit, HabitFrequency, HabitLog, HabitStreak, HabitTimeOfDay } from '../types/habit.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

export interface IHabitService {
  getHabits(userId?: string): Promise<ServiceResult<readonly Habit[]>>;
  getHabitLogs(userId?: string, habitId?: string, startDate?: DateOnlyString, endDate?: DateOnlyString): Promise<ServiceResult<readonly HabitLog[]>>;
  createHabit(userIdOrDto: string | CreateHabitDTO, maybeDto?: CreateHabitDTO): Promise<ServiceResult<Habit>>;
  updateHabit(userIdOrId: string, idOrUpdates: string | Partial<Habit>, maybeUpdates?: Partial<Habit>): Promise<ServiceResult<Habit>>;
  archiveHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  deleteHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  logHabitCompletion(userIdOrHabitId: string, habitIdOrDate: string, dateOrValue?: string | number, maybeValue?: number, maybeNotes?: string): Promise<ServiceResult<HabitLog>>;
  unlogHabitCompletion(userIdOrHabitId: string, habitIdOrDate: string, maybeDate?: string): Promise<ServiceResult<void>>;
  seedStarterHabits(userId: string): Promise<ServiceResult<Habit[]>>;
}

const STARTER_HABITS: readonly Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'streak'>[] = [
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
  return new Date().toISOString().split('T')[0];
}

export function isDayExpectedForFrequency(dateStr: string, frequency: HabitFrequency, customDays?: readonly number[]): boolean {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'three_times_weekly':
      return true; // Any 3 days
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

  const checkDate = new Date(`${today}T12:00:00.000Z`);
  const todayCompleted = completedDatesSet.has(today);

  // If not completed today, start checking from yesterday without breaking streak yet
  if (!todayCompleted) {
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  // Walk backwards day by day
  for (let i = 0; i < 365; i++) {
    const dStr = checkDate.toISOString().split('T')[0];
    const isExpected = isDayExpectedForFrequency(dStr, frequency, customDays);

    if (isExpected) {
      if (completedDatesSet.has(dStr)) {
        currentStreak++;
      } else {
        // Streak broken
        break;
      }
    }
    // Step 1 day back
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }

  // 2. Calculate Longest Streak
  let longestStreak = 0;
  let tempStreak = 0;

  if (sortedDates.length > 0) {
    const startDate = new Date(`${sortedDates[0]}T12:00:00.000Z`);
    const endDate = new Date(`${today}T12:00:00.000Z`);
    const scanDate = new Date(startDate);

    while (scanDate <= endDate) {
      const dStr = scanDate.toISOString().split('T')[0];
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
      scanDate.setUTCDate(scanDate.getUTCDate() + 1);
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

export class HabitService extends BaseService implements IHabitService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && !providedUserId.includes('@') && providedUserId.startsWith('usr_')) {
      return providedUserId;
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return 'usr_origin_demo';
  }

  private getHabitsStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.HABITS_PREFIX}${userId}`;
  }

  private getLogsStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.HABIT_LOGS_PREFIX}${userId}`;
  }

  private getStoredHabits(userId: string): Habit[] {
    const raw = safeStorage.get<Habit[]>(this.getHabitsStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_HABITS.map((sh) => ({
        ...sh,
        id: generateId('hab'),
        userId,
        streak: { currentStreak: 5, longestStreak: 12, totalCompletions: 18 },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getHabitsStorageKey(userId), seeded);

      // Seed starter logs for the last 5 days
      const seededLogs: HabitLog[] = [];
      const today = new Date();
      for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() - dayOffset);
        const dStr = d.toISOString().split('T')[0];

        seeded.forEach((h) => {
          if (isDayExpectedForFrequency(dStr, h.frequency, h.customDaysOfWeek)) {
            seededLogs.push({
              id: generateId('hlog'),
              userId,
              habitId: h.id,
              date: dStr,
              value: h.targetUnits,
              targetMet: true,
              loggedAt: d.toISOString(),
              createdAt: d.toISOString(),
              updatedAt: d.toISOString(),
            });
          }
        });
      }
      safeStorage.set(this.getLogsStorageKey(userId), seededLogs);
      return seeded;
    }
    return raw;
  }

  private getStoredLogs(userId: string): HabitLog[] {
    return safeStorage.get<HabitLog[]>(this.getLogsStorageKey(userId), []);
  }

  private saveStoredHabits(userId: string, habits: Habit[]): void {
    safeStorage.set(this.getHabitsStorageKey(userId), habits);
  }

  private saveStoredLogs(userId: string, logs: HabitLog[]): void {
    safeStorage.set(this.getLogsStorageKey(userId), logs);
  }

  async getHabits(userId?: string): Promise<ServiceResult<readonly Habit[]>> {
    try {
      const uid = await this.resolveUserId(userId);
      const habits = this.getStoredHabits(uid);
      const logs = this.getStoredLogs(uid);

      // Calculate dynamic real streaks for each habit
      const recalculatedHabits = habits.map((h) => {
        const habitLogs = logs.filter((l) => l.habitId === h.id && l.targetMet);
        const completedDatesSet = new Set(habitLogs.map((l) => l.date));
        const dynamicStreak = calculateHabitStreak(h.frequency, h.customDaysOfWeek, completedDatesSet);

        return {
          ...h,
          streak: dynamicStreak,
        };
      });

      return this.success(recalculatedHabits);
    } catch (err) {
      return this.failure('HABIT_FETCH_ERROR', 'Failed to retrieve habits.', { err });
    }
  }

  async getHabitLogs(
    userId?: string,
    habitId?: string,
    startDate?: DateOnlyString,
    endDate?: DateOnlyString
  ): Promise<ServiceResult<readonly HabitLog[]>> {
    try {
      const uid = await this.resolveUserId(userId);
      let logs = this.getStoredLogs(uid);

      if (habitId) {
        logs = logs.filter((l) => l.habitId === habitId);
      }
      if (startDate) {
        logs = logs.filter((l) => l.date >= startDate);
      }
      if (endDate) {
        logs = logs.filter((l) => l.date <= endDate);
      }

      return this.success(logs);
    } catch (err) {
      return this.failure('HABIT_LOGS_ERROR', 'Failed to retrieve habit logs.', { err });
    }
  }

  async createHabit(userIdOrDto: string | CreateHabitDTO, maybeDto?: CreateHabitDTO): Promise<ServiceResult<Habit>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateHabitDTO;

      if (!dto || !dto.name || dto.name.trim().length === 0) {
        return this.failure('HABIT_VALIDATION_ERROR', 'Habit name is required.');
      }
      if (!dto.routine || dto.routine.trim().length === 0) {
        return this.failure('HABIT_VALIDATION_ERROR', 'Habit routine is required.');
      }

      const habits = this.getStoredHabits(userId);
      const newHabit: Habit = {
        id: generateId('hab'),
        userId,
        name: dto.name.trim(),
        routine: dto.routine.trim(),
        cue: '',
        reward: '',
        category: dto.category || 'General',
        frequency: dto.frequency || 'daily',
        timeOfDay: dto.timeOfDay || 'anytime',
        targetUnits: dto.targetUnits || 1,
        unitLabel: dto.unitLabel || 'session',
        isArchived: false,
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          totalCompletions: 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      habits.unshift(newHabit);
      this.saveStoredHabits(userId, habits);

      return this.success(newHabit);
    } catch (err) {
      return this.failure('HABIT_CREATE_ERROR', 'Failed to create habit.', { err });
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

      const habits = this.getStoredHabits(userId);
      const index = habits.findIndex((h) => h.id === habitId);

      if (index === -1) {
        return this.failure('HABIT_NOT_FOUND', `Habit with ID ${habitId} not found.`);
      }

      const current = habits[index];
      const updatedHabit: Habit = {
        ...current,
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        routine: updates.routine !== undefined ? updates.routine.trim() : current.routine,
        updatedAt: new Date().toISOString(),
      };

      habits[index] = updatedHabit;
      this.saveStoredHabits(userId, habits);

      return this.success(updatedHabit);
    } catch (err) {
      return this.failure('HABIT_UPDATE_ERROR', 'Failed to update habit.', { err });
    }
  }

  async archiveHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const habitId = maybeId || userIdOrId;

      const habits = this.getStoredHabits(userId);
      const index = habits.findIndex((h) => h.id === habitId);

      if (index === -1) {
        return this.failure('HABIT_NOT_FOUND', `Habit with ID ${habitId} not found.`);
      }

      habits[index] = {
        ...habits[index],
        isArchived: true,
        updatedAt: new Date().toISOString(),
      };

      this.saveStoredHabits(userId, habits);
      return this.success(undefined);
    } catch (err) {
      return this.failure('HABIT_ARCHIVE_ERROR', 'Failed to archive habit.', { err });
    }
  }

  async deleteHabit(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const habitId = maybeId || userIdOrId;

      const habits = this.getStoredHabits(userId);
      const filteredHabits = habits.filter((h) => h.id !== habitId);

      if (filteredHabits.length === habits.length) {
        return this.failure('HABIT_NOT_FOUND', `Habit with ID ${habitId} not found.`);
      }

      this.saveStoredHabits(userId, filteredHabits);

      // Clean up associated logs
      const logs = this.getStoredLogs(userId);
      const filteredLogs = logs.filter((l) => l.habitId !== habitId);
      this.saveStoredLogs(userId, filteredLogs);

      return this.success(undefined);
    } catch (err) {
      return this.failure('HABIT_DELETE_ERROR', 'Failed to delete habit.', { err });
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

      const logs = this.getStoredLogs(userId);
      const habits = this.getStoredHabits(userId);
      const habit = habits.find((h) => h.id === habitId);

      const targetUnits = habit?.targetUnits || 1;
      const targetMet = value >= targetUnits;

      const existingIndex = logs.findIndex((l) => l.habitId === habitId && l.date === date);

      let logResult: HabitLog;

      if (existingIndex >= 0) {
        logResult = {
          ...logs[existingIndex],
          value,
          targetMet,
          notes: notes !== undefined ? notes : logs[existingIndex].notes,
          updatedAt: new Date().toISOString(),
        };
        logs[existingIndex] = logResult;
      } else {
        logResult = {
          id: generateId('hlog'),
          userId,
          habitId,
          date,
          value,
          targetMet,
          notes,
          loggedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        logs.push(logResult);
      }

      this.saveStoredLogs(userId, logs);
      return this.success(logResult);
    } catch (err) {
      return this.failure('HABIT_LOG_ERROR', 'Failed to log habit completion.', { err });
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

      const logs = this.getStoredLogs(userId);
      const filtered = logs.filter((l) => !(l.habitId === habitId && l.date === date));

      this.saveStoredLogs(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('HABIT_UNLOG_ERROR', 'Failed to remove habit log.', { err });
    }
  }

  async seedStarterHabits(userId: string): Promise<ServiceResult<Habit[]>> {
    try {
      const seeded = STARTER_HABITS.map((sh) => ({
        ...sh,
        id: generateId('hab'),
        userId,
        streak: { currentStreak: 3, longestStreak: 7, totalCompletions: 12 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      this.saveStoredHabits(userId, seeded);
      return this.success(seeded);
    } catch (err) {
      return this.failure('HABIT_SEED_ERROR', 'Failed to seed starter habits.', { err });
    }
  }
}

export const habitService = new HabitService();
