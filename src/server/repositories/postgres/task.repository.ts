import { query, withTransaction } from '../../db/postgres';
import { TaskRecord } from '../../db';
import { ITaskRepository, TaskFilterOptions } from '../interfaces';
import { mapTaskRow } from './mappers';

export class PostgresTaskRepository implements ITaskRepository {
  private async loadSubtasksForTasks(taskIds: string[]): Promise<Map<string, any[]>> {
    const map = new Map<string, any[]>();
    if (taskIds.length === 0) return map;

    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
    const res = await query(
      `SELECT * FROM task_subtasks WHERE task_id IN (${placeholders}) ORDER BY order_index ASC, created_at ASC`,
      taskIds
    );

    for (const row of res.rows) {
      if (!map.has(row.task_id)) {
        map.set(row.task_id, []);
      }
      map.get(row.task_id)!.push(row);
    }

    return map;
  }

  async findByUserId(userId: string, filter?: TaskFilterOptions): Promise<TaskRecord[]> {
    let sql = 'SELECT * FROM tasks WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filter?.priority) {
      params.push(filter.priority);
      sql += ` AND priority = $${params.length}`;
    }
    if (filter?.goalId) {
      params.push(filter.goalId);
      sql += ` AND goal_id = $${params.length}`;
    }
    if (filter?.dueBefore) {
      params.push(filter.dueBefore);
      sql += ` AND due_date <= $${params.length}`;
    }
    if (filter?.dueAfter) {
      params.push(filter.dueAfter);
      sql += ` AND due_date >= $${params.length}`;
    }
    if (filter?.tag) {
      params.push(filter.tag);
      sql += ` AND $${params.length} = ANY(tags)`;
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      sql += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    sql += ' ORDER BY created_at DESC';

    const res = await query(sql, params);
    if (res.rows.length === 0) return [];

    const taskIds = res.rows.map((r) => r.id);
    const subtasksMap = await this.loadSubtasksForTasks(taskIds);

    return res.rows.map((row) => mapTaskRow(row, subtasksMap.get(row.id) || []));
  }

  async findById(id: string, userId?: string): Promise<TaskRecord | null> {
    let sql = 'SELECT * FROM tasks WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;

    const subtasksMap = await this.loadSubtasksForTasks([id]);
    return mapTaskRow(res.rows[0], subtasksMap.get(id) || []);
  }

  async create(task: TaskRecord): Promise<TaskRecord> {
    return await withTransaction(async (client) => {
      const sql = `
        INSERT INTO tasks (
          id, user_id, goal_id, title, description, priority, status,
          due_date, scheduled_time, estimated_minutes, actual_minutes, tags,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14
        )
        RETURNING *
      `;

      const values = [
        task.id,
        task.userId,
        task.goalId || null,
        task.title,
        task.description || null,
        task.priority || 'medium',
        task.status || 'todo',
        task.dueDate || null,
        task.scheduledTime || null,
        task.estimatedMinutes != null ? task.estimatedMinutes : null,
        task.actualMinutes != null ? task.actualMinutes : null,
        Array.isArray(task.tags) ? task.tags : [],
        task.createdAt ? new Date(task.createdAt) : new Date(),
        task.updatedAt ? new Date(task.updatedAt) : new Date(),
      ];

      const res = await client.query(sql, values);
      const insertedTask = res.rows[0];

      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      for (let i = 0; i < subtasks.length; i++) {
        const s = subtasks[i];
        await client.query(
          `INSERT INTO task_subtasks (id, task_id, user_id, title, completed, order_index, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            s.id || `sub_${task.id}_${i + 1}`,
            task.id,
            task.userId,
            s.title,
            Boolean(s.completed),
            i + 1,
            new Date(),
            new Date(),
          ]
        );
      }

      return mapTaskRow(insertedTask, subtasks);
    });
  }

  async update(id: string, userId: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    return await withTransaction(async (client) => {
      const merged: TaskRecord = {
        ...existing,
        ...updates,
        id: existing.id,
        userId: existing.userId,
        updatedAt: new Date().toISOString(),
      };

      const sql = `
        UPDATE tasks SET
          goal_id = $3,
          title = $4,
          description = $5,
          priority = $6,
          status = $7,
          due_date = $8,
          scheduled_time = $9,
          estimated_minutes = $10,
          actual_minutes = $11,
          tags = $12,
          completed_at = $13,
          updated_at = $14
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const completedAt =
        merged.status === 'completed'
          ? (existing.status !== 'completed' ? new Date() : null)
          : null;

      const values = [
        id,
        userId,
        merged.goalId || null,
        merged.title,
        merged.description || null,
        merged.priority,
        merged.status,
        merged.dueDate || null,
        merged.scheduledTime || null,
        merged.estimatedMinutes != null ? merged.estimatedMinutes : null,
        merged.actualMinutes != null ? merged.actualMinutes : null,
        Array.isArray(merged.tags) ? merged.tags : [],
        completedAt,
        new Date(),
      ];

      const res = await client.query(sql, values);
      if (res.rows.length === 0) return null;

      if (updates.subtasks !== undefined) {
        await client.query('DELETE FROM task_subtasks WHERE task_id = $1 AND user_id = $2', [id, userId]);
        const subtasks = Array.isArray(updates.subtasks) ? updates.subtasks : [];
        for (let i = 0; i < subtasks.length; i++) {
          const s = subtasks[i];
          await client.query(
            `INSERT INTO task_subtasks (id, task_id, user_id, title, completed, order_index, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              s.id || `sub_${id}_${i + 1}`,
              id,
              userId,
              s.title,
              Boolean(s.completed),
              i + 1,
              new Date(),
              new Date(),
            ]
          );
        }
      }

      const subtasksRes = await client.query(
        'SELECT * FROM task_subtasks WHERE task_id = $1 ORDER BY order_index ASC',
        [id]
      );

      return mapTaskRow(res.rows[0], subtasksRes.rows);
    });
  }

  async updateStatus(id: string, userId: string, status: TaskRecord['status']): Promise<TaskRecord | null> {
    return this.update(id, userId, { status });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async countByUserId(userId: string, filter?: { excludeCanceled?: boolean }): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.excludeCanceled) {
      sql += " AND status != 'canceled'";
    }

    const res = await query(sql, params);
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}
