import { query } from '../../db/postgres';
import { AIMemoryRecord } from '../../db';
import { IAIMemoryRepository } from '../interfaces';
import { mapAIMemoryRow } from './mappers';

export class PostgresAIMemoryRepository implements IAIMemoryRepository {
  async findByUserId(userId: string): Promise<AIMemoryRecord[]> {
    const res = await query(
      'SELECT * FROM ai_memories WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return res.rows.map(mapAIMemoryRow);
  }

  async findByKey(userId: string, key: string): Promise<AIMemoryRecord | null> {
    const res = await query(
      'SELECT * FROM ai_memories WHERE user_id = $1 AND key = $2',
      [userId, key]
    );
    if (res.rows.length === 0) return null;
    return mapAIMemoryRow(res.rows[0]);
  }

  async create(memory: AIMemoryRecord): Promise<AIMemoryRecord> {
    const sql = `
      INSERT INTO ai_memories (
        id, user_id, key, value, category, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      ON CONFLICT (user_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        category = EXCLUDED.category,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      memory.id,
      memory.userId,
      memory.key,
      memory.value,
      memory.category || 'preference',
      memory.createdAt ? new Date(memory.createdAt) : new Date(),
      memory.updatedAt ? new Date(memory.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapAIMemoryRow(res.rows[0]);
  }

  async update(id: string, userId: string, updates: Partial<AIMemoryRecord>): Promise<AIMemoryRecord | null> {
    const resExisting = await query('SELECT * FROM ai_memories WHERE id = $1 AND user_id = $2', [id, userId]);
    if (resExisting.rows.length === 0) return null;

    const existing = mapAIMemoryRow(resExisting.rows[0]);
    const merged: AIMemoryRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const sql = `
      UPDATE ai_memories SET
        key = $3,
        value = $4,
        category = $5,
        updated_at = $6
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.key,
      merged.value,
      merged.category,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapAIMemoryRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM ai_memories WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}
