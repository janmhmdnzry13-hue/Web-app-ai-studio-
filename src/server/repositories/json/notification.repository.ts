import { db, NotificationRecord } from '../../db';
import { INotificationRepository } from '../interfaces';

export class JsonNotificationRepository implements INotificationRepository {
  async findByUserId(userId: string, options?: { isRead?: boolean; limit?: number }): Promise<NotificationRecord[]> {
    let list = db.schema.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options?.isRead !== undefined) {
      list = list.filter((n) => n.isRead === options.isRead);
    }
    if (options?.limit !== undefined) {
      list = list.slice(0, options.limit);
    }

    return list.map((n) => ({ ...n }));
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return db.schema.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  }

  async findById(id: string, userId: string): Promise<NotificationRecord | null> {
    const notif = db.schema.notifications.find((n) => n.id === id && n.userId === userId);
    return notif ? { ...notif } : null;
  }

  async findByScheduledNotificationId(scheduledNotificationId: string): Promise<NotificationRecord | null> {
    const notif = db.schema.notifications.find(
      (n) => n.scheduledNotificationId === scheduledNotificationId
    );
    return notif ? { ...notif } : null;
  }

  async create(notification: NotificationRecord): Promise<NotificationRecord> {
    db.schema.notifications.unshift(notification);
    await db.save();
    return { ...notification };
  }

  async createMany(notifications: NotificationRecord[]): Promise<NotificationRecord[]> {
    if (notifications.length === 0) return [];
    db.schema.notifications.unshift(...notifications);
    await db.save();
    return notifications.map((n) => ({ ...n }));
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const notif = db.schema.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notif) return null;

    const now = new Date().toISOString();
    notif.isRead = true;
    notif.readAt = now;
    notif.updatedAt = now;

    await db.save();
    return { ...notif };
  }

  async markAllAsRead(userId: string): Promise<number> {
    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const n of db.schema.notifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
        n.updatedAt = now;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await db.save();
    }
    return updatedCount;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const index = db.schema.notifications.findIndex((n) => n.id === id && n.userId === userId);
    if (index === -1) return false;

    db.schema.notifications.splice(index, 1);
    await db.save();
    return true;
  }

  async deleteAllByUserId(userId: string): Promise<number> {
    const beforeCount = db.schema.notifications.length;
    db.schema.notifications = db.schema.notifications.filter((n) => n.userId !== userId);
    const deletedCount = beforeCount - db.schema.notifications.length;

    if (deletedCount > 0) {
      await db.save();
    }
    return deletedCount;
  }
}
