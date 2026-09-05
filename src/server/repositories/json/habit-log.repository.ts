import { db, HabitLogRecord, HabitRecord } from '../../db';
import { IHabitLogRepository, HabitLogFilterOptions } from '../interfaces';
import { generateCryptoToken } from '../../auth';

export class JsonHabitLogRepository implements IHabitLogRepository {
  async findByUserId(userId: string, filter?: HabitLogFilterOptions): Promise<HabitLogRecord[]> {
    let logs = db.schema.habitLogs.filter((l) => l.userId === userId);

    if (filter) {
      if (filter.habitId) {
        logs = logs.filter((l) => l.habitId === filter.habitId);
      }
      if (filter.date) {
        logs = logs.filter((l) => l.date === filter.date);
      }
      if (filter.startDate) {
        logs = logs.filter((l) => l.date >= filter.startDate!);
      }
      if (filter.endDate) {
        logs = logs.filter((l) => l.date <= filter.endDate!);
      }
    }

    return logs.map((l) => ({ ...l }));
  }

  async findByHabitAndDate(userId: string, habitId: string, date: string): Promise<HabitLogRecord | null> {
    const log = db.schema.habitLogs.find(
      (l) => l.userId === userId && l.habitId === habitId && l.date === date
    );
    return log ? { ...log } : null;
  }

  async findById(id: string, userId?: string): Promise<HabitLogRecord | null> {
    const log = db.schema.habitLogs.find((l) => l.id === id && (!userId || l.userId === userId));
    return log ? { ...log } : null;
  }

  async logHabit(
    userId: string,
    habitId: string,
    data: { date?: string; completed?: boolean; value?: number; notes?: string }
  ): Promise<{ log: HabitLogRecord; habit: HabitRecord } | null> {
    const habit = db.schema.habits.find((h) => h.id === habitId && h.userId === userId);
    if (!habit) return null;

    const logDate = data.date || new Date().toISOString().slice(0, 10);
    let existingLog = db.schema.habitLogs.find(
      (l) => l.habitId === habitId && l.date === logDate && l.userId === userId
    );

    if (existingLog) {
      existingLog.completed = Boolean(data.completed);
      existingLog.value = data.value ?? (data.completed ? 1 : 0);
      existingLog.notes = data.notes;
    } else {
      existingLog = {
        id: generateCryptoToken('hlg'),
        userId,
        habitId,
        date: logDate,
        completed: Boolean(data.completed),
        value: data.value ?? 1,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };
      db.schema.habitLogs.push(existingLog);
    }

    // Recalculate streak
    const userLogs = db.schema.habitLogs.filter(
      (l) => l.habitId === habitId && l.userId === userId && l.completed
    );
    habit.totalCompletions = userLogs.length;
    habit.streakCount = Math.min(userLogs.length, habit.streakCount + (data.completed ? 1 : 0));
    habit.bestStreak = Math.max(habit.bestStreak, habit.streakCount);
    habit.updatedAt = new Date().toISOString();

    await db.save();
    return {
      log: { ...existingLog },
      habit: { ...habit },
    };
  }

  async create(log: HabitLogRecord): Promise<HabitLogRecord> {
    db.schema.habitLogs.push(log);
    await db.save();
    return { ...log };
  }

  async update(id: string, userId: string, updates: Partial<HabitLogRecord>): Promise<HabitLogRecord | null> {
    const log = db.schema.habitLogs.find((l) => l.id === id && l.userId === userId);
    if (!log) return null;

    Object.assign(log, updates, {
      id: log.id,
      userId,
    });

    await db.save();
    return { ...log };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.habitLogs.length;
    db.schema.habitLogs = db.schema.habitLogs.filter((l) => !(l.id === id && l.userId === userId));

    if (db.schema.habitLogs.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async unlogHabit(userId: string, habitId: string, date: string): Promise<boolean> {
    const habit = db.schema.habits.find((h) => h.id === habitId && h.userId === userId);
    const initialLen = db.schema.habitLogs.length;
    db.schema.habitLogs = db.schema.habitLogs.filter(
      (l) => !(l.habitId === habitId && l.userId === userId && l.date === date)
    );

    if (db.schema.habitLogs.length !== initialLen) {
      if (habit) {
        const userLogs = db.schema.habitLogs.filter(
          (l) => l.habitId === habitId && l.userId === userId && l.completed
        );
        habit.totalCompletions = userLogs.length;
        habit.streakCount = Math.min(habit.streakCount, userLogs.length);
        habit.updatedAt = new Date().toISOString();
      }
      await db.save();
      return true;
    }
    return false;
  }
}
