import { query, withTransaction } from '../../db/postgres';
import { RelationshipRecord } from '../../db';
import { IRelationshipRepository } from '../interfaces';
import { mapRelationshipRow } from './mappers';

export class PostgresRelationshipRepository implements IRelationshipRepository {
  private async loadAnniversariesForRelationships(relIds: string[]): Promise<Map<string, any[]>> {
    const map = new Map<string, any[]>();
    if (relIds.length === 0) return map;

    const placeholders = relIds.map((_, i) => `$${i + 1}`).join(', ');
    const res = await query(
      `SELECT * FROM relationship_important_dates WHERE relationship_id IN (${placeholders}) ORDER BY created_at ASC`,
      relIds
    );

    for (const row of res.rows) {
      if (!map.has(row.relationship_id)) {
        map.set(row.relationship_id, []);
      }
      map.get(row.relationship_id)!.push(row);
    }

    return map;
  }

  async findByUserId(userId: string): Promise<RelationshipRecord[]> {
    const res = await query(
      'SELECT * FROM relationships WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    if (res.rows.length === 0) return [];

    const relIds = res.rows.map((r) => r.id);
    const anniversariesMap = await this.loadAnniversariesForRelationships(relIds);

    return res.rows.map((row) => mapRelationshipRow(row, anniversariesMap.get(row.id) || []));
  }

  async findById(id: string, userId?: string): Promise<RelationshipRecord | null> {
    let sql = 'SELECT * FROM relationships WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;

    const anniversariesMap = await this.loadAnniversariesForRelationships([id]);
    return mapRelationshipRow(res.rows[0], anniversariesMap.get(id) || []);
  }

  async create(rel: RelationshipRecord): Promise<RelationshipRecord> {
    return await withTransaction(async (client) => {
      const sql = `
        INSERT INTO relationships (
          id, user_id, name, relation_type, cadence_days,
          last_interaction_date, next_due_reminder_date, notes,
          is_encrypted, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11
        )
        RETURNING *
      `;

      const values = [
        rel.id,
        rel.userId,
        rel.name,
        rel.relationType || 'friend',
        rel.cadenceDays != null ? rel.cadenceDays : 30,
        rel.lastInteractionDate || null,
        rel.nextDueReminderDate || null,
        rel.notes || null,
        Boolean(rel.isEncrypted),
        rel.createdAt ? new Date(rel.createdAt) : new Date(),
        rel.updatedAt ? new Date(rel.updatedAt) : new Date(),
      ];

      const res = await client.query(sql, values);
      const insertedRel = res.rows[0];

      const anniversaries = Array.isArray(rel.anniversaries) ? rel.anniversaries : [];
      for (let i = 0; i < anniversaries.length; i++) {
        const a = anniversaries[i];
        await client.query(
          `INSERT INTO relationship_important_dates (id, relationship_id, user_id, label, date, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `date_${rel.id}_${i + 1}`,
            rel.id,
            rel.userId,
            a.label,
            a.date,
            new Date(),
          ]
        );
      }

      return mapRelationshipRow(insertedRel, anniversaries);
    });
  }

  async update(id: string, userId: string, updates: Partial<RelationshipRecord>): Promise<RelationshipRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    return await withTransaction(async (client) => {
      const merged: RelationshipRecord = {
        ...existing,
        ...updates,
        id: existing.id,
        userId: existing.userId,
        updatedAt: new Date().toISOString(),
      };

      const sql = `
        UPDATE relationships SET
          name = $3,
          relation_type = $4,
          cadence_days = $5,
          last_interaction_date = $6,
          next_due_reminder_date = $7,
          notes = $8,
          is_encrypted = $9,
          updated_at = $10
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const values = [
        id,
        userId,
        merged.name,
        merged.relationType,
        merged.cadenceDays,
        merged.lastInteractionDate || null,
        merged.nextDueReminderDate || null,
        merged.notes || null,
        Boolean(merged.isEncrypted),
        new Date(),
      ];

      const res = await client.query(sql, values);
      if (res.rows.length === 0) return null;

      if (updates.anniversaries !== undefined) {
        await client.query('DELETE FROM relationship_important_dates WHERE relationship_id = $1 AND user_id = $2', [id, userId]);
        const anniversaries = Array.isArray(updates.anniversaries) ? updates.anniversaries : [];
        for (let i = 0; i < anniversaries.length; i++) {
          const a = anniversaries[i];
          await client.query(
            `INSERT INTO relationship_important_dates (id, relationship_id, user_id, label, date, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              `date_${id}_${i + 1}`,
              id,
              userId,
              a.label,
              a.date,
              new Date(),
            ]
          );
        }
      }

      const datesRes = await client.query(
        'SELECT * FROM relationship_important_dates WHERE relationship_id = $1 ORDER BY created_at ASC',
        [id]
      );

      return mapRelationshipRow(res.rows[0], datesRes.rows);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM relationships WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}
