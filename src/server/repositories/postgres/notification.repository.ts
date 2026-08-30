import { query, withTransaction } from '../../db/postgres';
import { NotificationRecord } from '../../db';
import { INotificationRepository } from '../interfaces';
import { mapNotificationRow } from './mappers';

export class PostgresNotificationRepository implements INotificationRepository {
  async findByUserId(userId: string, options?: { isRead?: boolean; limit?: number }): Promise<NotificationRecord[]> {
    let sql = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: any[] = [userId];

    if (options?.isRead !== undefined) {
      params.push(options.isRead);
      sql += ` AND is_read = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit && options.limit > 0) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const res = await query(sql, params);
    return res.rows.map(mapNotificationRow);
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const res = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  async findById(id: string, userId: string): Promise<NotificationRecord | null> {
    const res = await query('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
    if (res.rows.length === 0) return null;
    return mapNotificationRow(res.rows[0]);
  }

  async findByScheduledNotificationId(scheduledNotificationId: string): Promise<NotificationRecord | null> {
    const res = await query(
      'SELECT * FROM notifications WHERE scheduled_notification_id = $1',
      [scheduledNotificationId]
    );
    if (res.rows.length === 0) return null;
    return mapNotificationRow(res.rows[0]);
  }

  async create(notification: NotificationRecord): Promise<NotificationRecord> {
    const sql = `
      INSERT INTO notifications (
        id, user_id, scheduled_notification_id, type, title, message,
        priority, is_read, read_at, action_url, entity_type, entity_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14
      )
      RETURNING *
    `;

    const values = [
      notification.id,
      notification.userId,
      notification.scheduledNotificationId || null,
      notification.type || 'system_alert',
      notification.title,
      notification.message,
      notification.priority || 'medium',
      Boolean(notification.isRead),
      notification.readAt ? new Date(notification.readAt) : null,
      notification.actionUrl || null,
      notification.entityReference?.type || null,
      notification.entityReference?.id || null,
      notification.createdAt ? new Date(notification.createdAt) : new Date(),
      notification.updatedAt ? new Date(notification.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapNotificationRow(res.rows[0]);
  }

  async createMany(notifications: NotificationRecord[]): Promise<NotificationRecord[]> {
    if (notifications.length === 0) return [];

    return await withTransaction(async (client) => {
      const results: NotificationRecord[] = [];
      for (const n of notifications) {
        const sql = `
          INSERT INTO notifications (
            id, user_id, scheduled_notification_id, type, title, message,
            priority, is_read, read_at, action_url, entity_type, entity_id,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14
          )
          RETURNING *
        `;

        const values = [
          n.id,
          n.userId,
          n.scheduledNotificationId || null,
          n.type || 'system_alert',
          n.title,
          n.message,
          n.priority || 'medium',
          Boolean(n.isRead),
          n.readAt ? new Date(n.readAt) : null,
          n.actionUrl || null,
          n.entityReference?.type || null,
          n.entityReference?.id || null,
          n.createdAt ? new Date(n.createdAt) : new Date(),
          n.updatedAt ? new Date(n.updatedAt) : new Date(),
        ];

        const res = await client.query(sql, values);
        results.push(mapNotificationRow(res.rows[0]));
      }
      return results;
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const sql = `
      UPDATE notifications SET
        is_read = TRUE,
        read_at = $3,
        updated_at = $4
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const res = await query(sql, [id, userId, new Date(), new Date()]);
    if (res.rows.length === 0) return null;
    return mapNotificationRow(res.rows[0]);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const sql = `
      UPDATE notifications SET
        is_read = TRUE,
        read_at = $2,
        updated_at = $3
      WHERE user_id = $1 AND is_read = FALSE
    `;

    const res = await query(sql, [userId, new Date(), new Date()]);
    return res.rowCount || 0;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async deleteAllByUserId(userId: string): Promise<number> {
    const res = await query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    return res.rowCount || 0;
  }
}
