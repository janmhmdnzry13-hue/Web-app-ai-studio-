import { db, HabitRecord } from '../../db';
import { IHabitRepository } from '../interfaces';

export class JsonHabitRepository implements IHabitRepository {
  async findByUserId(userId: string, filter?: { archived?: boolean }): Promise<HabitRecord[]> {
    let habits = db.schema.habits.filter((h) => h.userId === userId);
    if (filter?.archived !== undefined) {
      habits = habits.filter((h) => h.archived === filter.archived);
    }
    return habits.map((h) => ({ ...h }));
  }

  async findById(id: string, userId?: string): Promise<HabitRecord | null> {
    const habit = db.schema.habits.find((h) => h.id === id && (!userId || h.userId === userId));
    return habit ? { ...habit } : null;
  }

  async create(habit: HabitRecord): Promise<HabitRecord> {
    db.schema.habits.unshift(habit);
    await db.save();
    return { ...habit };
  }

  async update(id: string, userId: string, updates: Partial<HabitRecord>): Promise<HabitRecord | null> {
    const habit = db.schema.habits.find((h) => h.id === id && h.userId === userId);
    if (!habit) return null;

    Object.assign(habit, updates, {
      id: habit.id,
      userId, // Strictly preserve user ownership
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...habit };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.habits.length;
    db.schema.habits = db.schema.habits.filter((h) => !(h.id === id && h.userId === userId));

    if (db.schema.habits.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return db.schema.habits.filter((h) => h.userId === userId && !h.archived).length;
  }
}
