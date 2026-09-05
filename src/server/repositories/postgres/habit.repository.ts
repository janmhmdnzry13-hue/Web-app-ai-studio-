import { query } from '../../db/postgres';
import { HabitRecord } from '../../db';
import { IHabitRepository } from '../interfaces';
import { mapHabitRow } from './mappers';

export class PostgresHabitRepository implements IHabitRepository {
  async findByUserId(userId: string, filter?: { archived?: boolean }): Promise<HabitRecord[]> {
    let sql = 'SELECT * FROM habits WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.archived !== undefined) {
      params.push(filter.archived);
      sql += ` AND archived = $${params.length}`;
    }

    sql += ' ORDER BY created_at ASC';

    const res = await query(sql, params);
    return res.rows.map(mapHabitRow);
  }

  async findById(id: string, userId?: string): Promise<HabitRecord | null> {
    let sql = 'SELECT * FROM habits WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return mapHabitRow(res.rows[0]);
  }

  async create(habit: HabitRecord): Promise<HabitRecord> {
    const targetDays = Array.isArray(habit.targetDays)
      ? habit.targetDays
      : Array.isArray(habit.customDaysOfWeek)
      ? habit.customDaysOfWeek
      : [];
    const targetUnits = habit.targetUnits != null ? habit.targetUnits : (habit.targetPerDay != null ? habit.targetPerDay : 1);
    const unitLabel = habit.unitLabel || habit.unit || 'session';

    const sql = `
      INSERT INTO habits (
        id, user_id, goal_id, name, description, cue, routine, reward,
        category, frequency, target_days, target_per_day, target_units,
        unit, unit_label, time_of_day, reminder_time, streak_count,
        best_streak, total_completions, archived, why, icon, color,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26
      )
      RETURNING *
    `;

    const values = [
      habit.id,
      habit.userId,
      habit.goalId || null,
      habit.name,
      habit.description || null,
      habit.cue || null,
      habit.routine || null,
      habit.reward || null,
      habit.category || 'Health & Vitality',
      habit.frequency || 'daily',
      targetDays,
      habit.targetPerDay != null ? habit.targetPerDay : targetUnits,
      targetUnits,
      habit.unit || unitLabel,
      unitLabel,
      habit.timeOfDay || 'morning',
      habit.reminderTime || null,
      habit.streakCount != null ? habit.streakCount : 0,
      habit.bestStreak != null ? habit.bestStreak : 0,
      habit.totalCompletions != null ? habit.totalCompletions : 0,
      Boolean(habit.archived || habit.isArchived),
      habit.why || null,
      habit.icon || null,
      habit.color || null,
      habit.createdAt ? new Date(habit.createdAt) : new Date(),
      habit.updatedAt ? new Date(habit.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapHabitRow(res.rows[0]);
  }

  async update(id: string, userId: string, updates: Partial<HabitRecord>): Promise<HabitRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: HabitRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const targetDays = Array.isArray(merged.targetDays)
      ? merged.targetDays
      : Array.isArray(merged.customDaysOfWeek)
      ? merged.customDaysOfWeek
      : [];
    const targetUnits = merged.targetUnits != null ? merged.targetUnits : (merged.targetPerDay != null ? merged.targetPerDay : 1);
    const unitLabel = merged.unitLabel || merged.unit || 'session';

    const sql = `
      UPDATE habits SET
        goal_id = $3,
        name = $4,
        description = $5,
        cue = $6,
        routine = $7,
        reward = $8,
        category = $9,
        frequency = $10,
        target_days = $11,
        target_per_day = $12,
        target_units = $13,
        unit = $14,
        unit_label = $15,
        time_of_day = $16,
        reminder_time = $17,
        streak_count = $18,
        best_streak = $19,
        total_completions = $20,
        archived = $21,
        why = $22,
        icon = $23,
        color = $24,
        updated_at = $25
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.goalId || null,
      merged.name,
      merged.description || null,
      merged.cue || null,
      merged.routine || null,
      merged.reward || null,
      merged.category,
      merged.frequency,
      targetDays,
      merged.targetPerDay != null ? merged.targetPerDay : targetUnits,
      targetUnits,
      merged.unit || unitLabel,
      unitLabel,
      merged.timeOfDay || 'morning',
      merged.reminderTime || null,
      merged.streakCount,
      merged.bestStreak,
      merged.totalCompletions,
      Boolean(merged.archived || merged.isArchived),
      merged.why || null,
      merged.icon || null,
      merged.color || null,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapHabitRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM habits WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const res = await query(
      'SELECT COUNT(*) as count FROM habits WHERE user_id = $1 AND archived = FALSE',
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}
