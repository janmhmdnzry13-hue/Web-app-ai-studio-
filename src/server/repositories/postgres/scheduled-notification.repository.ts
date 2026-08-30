import { query } from '../../db/postgres';
import { ScheduledNotificationRecord } from '../../db';
import { IScheduledNotificationRepository } from '../interfaces';
import { mapScheduledNotificationRow } from './mappers';

export class PostgresScheduledNotificationRepository implements IScheduledNotificationRepository {
  async findByUserId(userId: string): Promise<ScheduledNotificationRecord[]> {
    const res = await query(
      'SELECT * FROM scheduled_notifications WHERE user_id = $1 ORDER BY scheduled_for ASC',
      [userId]
    );
    return res.rows.map(mapScheduledNotificationRow);
  }

  async findById(id: string, userId: string): Promise<ScheduledNotificationRecord | null> {
    const res = await query(
      'SELECT * FROM scheduled_notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (res.rows.length === 0) return null;
    return mapScheduledNotificationRow(res.rows[0]);
  }

  async findDue(targetTimeMs: number): Promise<ScheduledNotificationRecord[]> {
    const targetDate = new Date(targetTimeMs);
    const res = await query(
      "SELECT * FROM scheduled_notifications WHERE status = 'scheduled' AND scheduled_for <= $1 ORDER BY scheduled_for ASC",
      [targetDate]
    );
    return res.rows.map(mapScheduledNotificationRow);
  }

  async create(record: ScheduledNotificationRecord): Promise<ScheduledNotificationRecord> {
    const sql = `
      INSERT INTO scheduled_notifications (
        id, user_id, type, title, message, priority,
        scheduled_for, status, delivered_at, action_url,
        entity_type, entity_id, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15
      )
      RETURNING *
    `;

    const values = [
      record.id,
      record.userId,
      record.type || 'custom_reminder',
      record.title,
      record.message,
      record.priority || 'medium',
      new Date(record.scheduledFor),
      record.status || 'scheduled',
      record.deliveredAt ? new Date(record.deliveredAt) : null,
      record.actionUrl || null,
      record.entityReference?.type || null,
      record.entityReference?.id || null,
      record.metadata ? JSON.stringify(record.metadata) : null,
      record.createdAt ? new Date(record.createdAt) : new Date(),
      record.updatedAt ? new Date(record.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapScheduledNotificationRow(res.rows[0]);
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<ScheduledNotificationRecord>
  ): Promise<ScheduledNotificationRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: ScheduledNotificationRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const sql = `
      UPDATE scheduled_notifications SET
        type = $3,
        title = $4,
        message = $5,
        priority = $6,
        scheduled_for = $7,
        status = $8,
        delivered_at = $9,
        action_url = $10,
        entity_type = $11,
        entity_id = $12,
        metadata = $13,
        updated_at = $14
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.type,
      merged.title,
      merged.message,
      merged.priority,
      new Date(merged.scheduledFor),
      merged.status,
      merged.deliveredAt ? new Date(merged.deliveredAt) : null,
      merged.actionUrl || null,
      merged.entityReference?.type || null,
      merged.entityReference?.id || null,
      merged.metadata ? JSON.stringify(merged.metadata) : null,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapScheduledNotificationRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<ScheduledNotificationRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    await query('DELETE FROM scheduled_notifications WHERE id = $1 AND user_id = $2', [id, userId]);
    return existing;
  }
}
