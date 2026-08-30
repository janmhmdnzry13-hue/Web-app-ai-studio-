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
    const sql = `
      INSERT INTO habits (
        id, user_id, name, description, category, frequency,
        target_days, target_per_day, unit, reminder_time,
        streak_count, best_streak, total_completions, archived,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16
      )
      RETURNING *
    `;

    const values = [
      habit.id,
      habit.userId,
      habit.name,
      habit.description || null,
      habit.category || 'health',
      habit.frequency || 'daily',
      Array.isArray(habit.targetDays) ? habit.targetDays : null,
      habit.targetPerDay != null ? habit.targetPerDay : 1,
      habit.unit || null,
      habit.reminderTime || null,
      habit.streakCount != null ? habit.streakCount : 0,
      habit.bestStreak != null ? habit.bestStreak : 0,
      habit.totalCompletions != null ? habit.totalCompletions : 0,
      Boolean(habit.archived),
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

    const sql = `
      UPDATE habits SET
        name = $3,
        description = $4,
        category = $5,
        frequency = $6,
        target_days = $7,
        target_per_day = $8,
        unit = $9,
        reminder_time = $10,
        streak_count = $11,
        best_streak = $12,
        total_completions = $13,
        archived = $14,
        updated_at = $15
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.name,
      merged.description || null,
      merged.category,
      merged.frequency,
      Array.isArray(merged.targetDays) ? merged.targetDays : null,
      merged.targetPerDay,
      merged.unit || null,
      merged.reminderTime || null,
      merged.streakCount,
      merged.bestStreak,
      merged.totalCompletions,
      Boolean(merged.archived),
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
