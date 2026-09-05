import { query, withTransaction } from '../../db/postgres';
import { HabitLogRecord, HabitRecord } from '../../db';
import { IHabitLogRepository, HabitLogFilterOptions } from '../interfaces';
import { mapHabitLogRow, mapHabitRow } from './mappers';
import { generateCryptoToken } from '../../auth';

export class PostgresHabitLogRepository implements IHabitLogRepository {
  async findByUserId(userId: string, filter?: HabitLogFilterOptions): Promise<HabitLogRecord[]> {
    let sql = 'SELECT * FROM habit_logs WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.habitId) {
      params.push(filter.habitId);
      sql += ` AND habit_id = $${params.length}`;
    }
    if (filter?.date) {
      params.push(filter.date);
      sql += ` AND date = $${params.length}`;
    }
    if (filter?.startDate) {
      params.push(filter.startDate);
      sql += ` AND date >= $${params.length}`;
    }
    if (filter?.endDate) {
      params.push(filter.endDate);
      sql += ` AND date <= $${params.length}`;
    }
    if (filter?.completedOnly) {
      sql += ' AND completed = TRUE';
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const res = await query(sql, params);
    return res.rows.map(mapHabitLogRow);
  }

  async findByHabitAndDate(userId: string, habitId: string, date: string): Promise<HabitLogRecord | null> {
    const res = await query(
      'SELECT * FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND date = $3',
      [userId, habitId, date]
    );
    if (res.rows.length === 0) return null;
    return mapHabitLogRow(res.rows[0]);
  }

  async findById(id: string, userId?: string): Promise<HabitLogRecord | null> {
    let sql = 'SELECT * FROM habit_logs WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return mapHabitLogRow(res.rows[0]);
  }

  async logHabit(
    userId: string,
    habitId: string,
    data: { date?: string; completed?: boolean; value?: number; notes?: string }
  ): Promise<{ log: HabitLogRecord; habit: HabitRecord } | null> {
    return await withTransaction(async (client) => {
      // 1. Verify habit exists and belongs to user
      const habitRes = await client.query('SELECT * FROM habits WHERE id = $1 AND user_id = $2', [
        habitId,
        userId,
      ]);
      if (habitRes.rows.length === 0) return null;

      const logDate = data.date || new Date().toISOString().slice(0, 10);
      const isCompleted = Boolean(data.completed);
      const val = data.value ?? (isCompleted ? 1 : 0);
      const notes = data.notes || null;

      // 2. Upsert habit_log on (user_id, habit_id, date)
      const upsertSql = `
        INSERT INTO habit_logs (
          id, user_id, habit_id, date, completed, value, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, habit_id, date) DO UPDATE SET
          completed = EXCLUDED.completed,
          value = EXCLUDED.value,
          notes = EXCLUDED.notes
        RETURNING *
      `;

      const newId = generateCryptoToken('hlg');
      const upsertRes = await client.query(upsertSql, [
        newId,
        userId,
        habitId,
        logDate,
        isCompleted,
        val,
        notes,
        new Date(),
      ]);
      const savedLog = mapHabitLogRow(upsertRes.rows[0]);

      // 3. Recalculate streak & total completions
      const countRes = await client.query(
        'SELECT COUNT(*) as completions FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND completed = TRUE',
        [userId, habitId]
      );
      const totalCompletions = parseInt(countRes.rows[0]?.completions || '0', 10);

      const existingHabit = habitRes.rows[0];
      const prevStreak = Number(existingHabit.streak_count || 0);
      const newStreak = Math.min(totalCompletions, prevStreak + (isCompleted ? 1 : 0));
      const bestStreak = Math.max(Number(existingHabit.best_streak || 0), newStreak);

      const updatedHabitRes = await client.query(
        `UPDATE habits SET
          total_completions = $3,
          streak_count = $4,
          best_streak = $5,
          updated_at = $6
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
        [habitId, userId, totalCompletions, newStreak, bestStreak, new Date()]
      );

      const savedHabit = mapHabitRow(updatedHabitRes.rows[0]);

      return {
        log: savedLog,
        habit: savedHabit,
      };
    });
  }

  async create(log: HabitLogRecord): Promise<HabitLogRecord> {
    const sql = `
      INSERT INTO habit_logs (
        id, user_id, habit_id, date, completed, value, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, habit_id, date) DO UPDATE SET
        completed = EXCLUDED.completed,
        value = EXCLUDED.value,
        notes = EXCLUDED.notes
      RETURNING *
    `;

    const values = [
      log.id,
      log.userId,
      log.habitId,
      log.date,
      Boolean(log.completed),
      log.value != null ? log.value : 1,
      log.notes || null,
      log.createdAt ? new Date(log.createdAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapHabitLogRow(res.rows[0]);
  }

  async update(id: string, userId: string, updates: Partial<HabitLogRecord>): Promise<HabitLogRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
    };

    const sql = `
      UPDATE habit_logs SET
        date = $3,
        completed = $4,
        value = $5,
        notes = $6
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.date,
      Boolean(merged.completed),
      merged.value != null ? merged.value : 1,
      merged.notes || null,
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapHabitLogRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM habit_logs WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async unlogHabit(userId: string, habitId: string, date: string): Promise<boolean> {
    return await withTransaction(async (client) => {
      const res = await client.query(
        'DELETE FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND date = $3',
        [userId, habitId, date]
      );
      const deleted = (res.rowCount || 0) > 0;
      if (deleted) {
        const countRes = await client.query(
          'SELECT COUNT(*) as completions FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND completed = TRUE',
          [userId, habitId]
        );
        const totalCompletions = parseInt(countRes.rows[0]?.completions || '0', 10);
        await client.query(
          `UPDATE habits SET
            total_completions = $3,
            streak_count = LEAST(streak_count, $3),
            updated_at = $4
          WHERE id = $1 AND user_id = $2`,
          [habitId, userId, totalCompletions, new Date()]
        );
      }
      return deleted;
    });
  }
}
