import { query, withTransaction } from '../../db/postgres';
import { GoalRecord } from '../../db';
import { IGoalRepository } from '../interfaces';
import { mapGoalRow } from './mappers';

export class PostgresGoalRepository implements IGoalRepository {
  private async loadMilestonesForGoals(goalIds: string[]): Promise<Map<string, any[]>> {
    const map = new Map<string, any[]>();
    if (goalIds.length === 0) return map;

    const placeholders = goalIds.map((_, i) => `$${i + 1}`).join(', ');
    const res = await query(
      `SELECT * FROM goal_milestones WHERE goal_id IN (${placeholders}) ORDER BY order_index ASC, created_at ASC`,
      goalIds
    );

    for (const row of res.rows) {
      if (!map.has(row.goal_id)) {
        map.set(row.goal_id, []);
      }
      map.get(row.goal_id)!.push(row);
    }

    return map;
  }

  async findByUserId(userId: string, filter?: { status?: string }): Promise<GoalRecord[]> {
    let sql = 'SELECT * FROM goals WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const res = await query(sql, params);
    if (res.rows.length === 0) return [];

    const goalIds = res.rows.map((r) => r.id);
    const milestonesMap = await this.loadMilestonesForGoals(goalIds);

    return res.rows.map((row) => mapGoalRow(row, milestonesMap.get(row.id) || []));
  }

  async findById(id: string, userId?: string): Promise<GoalRecord | null> {
    let sql = 'SELECT * FROM goals WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;

    const milestonesMap = await this.loadMilestonesForGoals([id]);
    return mapGoalRow(res.rows[0], milestonesMap.get(id) || []);
  }

  async create(goal: GoalRecord): Promise<GoalRecord> {
    return await withTransaction(async (client) => {
      const sql = `
        INSERT INTO goals (
          id, user_id, title, description, category, horizon,
          target_date, progress_percentage, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11
        )
        RETURNING *
      `;

      const values = [
        goal.id,
        goal.userId,
        goal.title,
        goal.description || null,
        goal.category || 'personal',
        goal.horizon || 'annual',
        goal.targetDate,
        goal.progressPercentage != null ? goal.progressPercentage : 0,
        goal.status || 'active',
        goal.createdAt ? new Date(goal.createdAt) : new Date(),
        goal.updatedAt ? new Date(goal.updatedAt) : new Date(),
      ];

      const res = await client.query(sql, values);
      const insertedGoal = res.rows[0];

      const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await client.query(
          `INSERT INTO goal_milestones (
            id, goal_id, user_id, title, completed, target_date, order_index, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            m.id || `mil_${goal.id}_${i + 1}`,
            goal.id,
            goal.userId,
            m.title,
            Boolean(m.completed),
            m.dueDate || null,
            m.order != null ? m.order : i + 1,
            new Date(),
            new Date(),
          ]
        );
      }

      return mapGoalRow(insertedGoal, milestones);
    });
  }

  async update(id: string, userId: string, updates: Partial<GoalRecord>): Promise<GoalRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    return await withTransaction(async (client) => {
      const merged: GoalRecord = {
        ...existing,
        ...updates,
        id: existing.id,
        userId: existing.userId,
        updatedAt: new Date().toISOString(),
      };

      const sql = `
        UPDATE goals SET
          title = $3,
          description = $4,
          category = $5,
          horizon = $6,
          target_date = $7,
          progress_percentage = $8,
          status = $9,
          updated_at = $10
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const values = [
        id,
        userId,
        merged.title,
        merged.description || null,
        merged.category,
        merged.horizon,
        merged.targetDate,
        merged.progressPercentage != null ? merged.progressPercentage : 0,
        merged.status,
        new Date(),
      ];

      const res = await client.query(sql, values);
      if (res.rows.length === 0) return null;

      if (updates.milestones !== undefined) {
        await client.query('DELETE FROM goal_milestones WHERE goal_id = $1 AND user_id = $2', [id, userId]);
        const milestones = Array.isArray(updates.milestones) ? updates.milestones : [];
        for (let i = 0; i < milestones.length; i++) {
          const m = milestones[i];
          await client.query(
            `INSERT INTO goal_milestones (
              id, goal_id, user_id, title, completed, target_date, order_index, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              m.id || `mil_${id}_${i + 1}`,
              id,
              userId,
              m.title,
              Boolean(m.completed),
              m.dueDate || null,
              m.order != null ? m.order : i + 1,
              new Date(),
              new Date(),
            ]
          );
        }
      }

      const milestonesRes = await client.query(
        'SELECT * FROM goal_milestones WHERE goal_id = $1 ORDER BY order_index ASC',
        [id]
      );

      return mapGoalRow(res.rows[0], milestonesRes.rows);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const res = await query(
      "SELECT COUNT(*) as count FROM goals WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}
